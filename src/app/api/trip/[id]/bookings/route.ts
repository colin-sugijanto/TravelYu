import { revalidateTag } from "next/cache";

import { getCurrentAppUser } from "@/lib/auth";
import { checkBookingCreationAllowed } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";
import type { BookingType } from "@/types/domain";

const VALID_TYPES: BookingType[] = ["flight", "train", "hotel", "ferry", "bus", "activity", "other"];

async function resolveTrip(id: string, userId: string) {
  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) return { error: Response.json({ error: "Trip not found" }, { status: 404 }) as Response, trip: null };
  if (trip.user_id !== userId) {
    const member = await isTripMember(trip.id, userId);
    if (!member) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) as Response, trip: null };
  }
  return { error: null, trip };
}

/** GET /api/trip/[id]/bookings — shared Ticket Locker (owner + group members). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error, trip } = await resolveTrip(id, appUser.id);
  if (error || !trip) return error ?? Response.json({ error: "Trip not found" }, { status: 404 });

  try {
    const { data, error: dbError } = await supabaseAdmin
      .from("trip_bookings")
      .select("*")
      .eq("trip_id", trip.id)
      .order("depart_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (dbError) throw dbError;
    return Response.json({ bookings: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/does not exist|relation/i.test(message)) return Response.json({ bookings: [], migrationPending: true });
    return Response.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

/** POST /api/trip/[id]/bookings — save a parsed or manual booking. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error, trip } = await resolveTrip(id, appUser.id);
  if (error || !trip) return error ?? Response.json({ error: "Trip not found" }, { status: 404 });

  const gate = await checkBookingCreationAllowed(trip.id, appUser.id);
  if (!gate.ok) return Response.json({ error: gate.error, code: "PLAN_LIMIT", upgradeUrl: "/plans" }, { status: 402 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ error: "Judul booking wajib diisi." }, { status: 400 });

  const bookingType = VALID_TYPES.includes(body.booking_type as BookingType)
    ? (body.booking_type as BookingType)
    : "other";

  const row = {
    trip_id: trip.id,
    user_id: appUser.id,
    booking_type: bookingType,
    provider: typeof body.provider === "string" ? body.provider.slice(0, 120) || null : null,
    booking_ref: typeof body.booking_ref === "string" ? body.booking_ref.slice(0, 64) || null : null,
    title: title.slice(0, 200),
    origin: typeof body.origin === "string" ? body.origin.slice(0, 120) || null : null,
    destination: typeof body.destination === "string" ? body.destination.slice(0, 120) || null : null,
    depart_at: typeof body.depart_at === "string" && body.depart_at ? body.depart_at : null,
    arrive_at: typeof body.arrive_at === "string" && body.arrive_at ? body.arrive_at : null,
    check_in: typeof body.check_in === "string" && body.check_in ? body.check_in : null,
    check_out: typeof body.check_out === "string" && body.check_out ? body.check_out : null,
    details: (body.details as Record<string, unknown>) ?? {},
    file_url: typeof body.file_url === "string" ? body.file_url.slice(0, 500) || null : null,
    linked_item_id: typeof body.linked_item_id === "string" && body.linked_item_id ? body.linked_item_id : null,
  };

  try {
    const { data, error: dbError } = await supabaseAdmin
      .from("trip_bookings")
      .insert(row)
      .select("*")
      .single();
    if (dbError) throw dbError;

    revalidateTag(`trip:${trip.id}`, "max");
    return Response.json({ ok: true, booking: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save booking";
    if (/does not exist|relation/i.test(message)) {
      return Response.json(
        { error: "Tabel trip_bookings belum tersedia. Jalankan migrasi 014 terlebih dahulu." },
        { status: 500 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/trip/[id]/bookings?bookingId=... */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("bookingId");
  if (!bookingId) return Response.json({ error: "bookingId is required" }, { status: 400 });

  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error, trip } = await resolveTrip(id, appUser.id);
  if (error || !trip) return error ?? Response.json({ error: "Trip not found" }, { status: 404 });

  try {
    const { data: booking } = await supabaseAdmin
      .from("trip_bookings")
      .select("id,user_id")
      .eq("id", bookingId)
      .eq("trip_id", trip.id)
      .maybeSingle();

    if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });
    if ((booking as { user_id: string }).user_id !== appUser.id && trip.user_id !== appUser.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await supabaseAdmin.from("trip_bookings").delete().eq("id", bookingId);
    revalidateTag(`trip:${trip.id}`, "max");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to delete booking" }, { status: 500 });
  }
}
