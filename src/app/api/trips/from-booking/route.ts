import { getCurrentAppUser } from "@/lib/auth";
import { checkTripCreationAllowed } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BookingType } from "@/types/domain";

const VALID_TYPES: BookingType[] = ["flight", "train", "hotel", "ferry", "bus", "activity", "other"];

function isoDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
    return m?.[1] ?? null;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * POST /api/trips/from-booking — "Buat trip dari tiket saya".
 * Body: { parsed: ParsedBooking, fileUrl?: string }
 * Creates a trip scaffold (where/when prefilled, status intake) + booking row,
 * so AI intake/generate can plan *around* the fixed ticket.
 */
export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkTripCreationAllowed(appUser.id);
  if (!gate.ok) return Response.json({ error: gate.error, code: "PLAN_LIMIT", upgradeUrl: "/plans" }, { status: 402 });

  let body: {
    parsed?: {
      booking_type?: BookingType;
      provider?: string | null;
      booking_ref?: string | null;
      title?: string;
      origin?: string | null;
      destination?: string | null;
      depart_at?: string | null;
      arrive_at?: string | null;
      check_in?: string | null;
      check_out?: string | null;
      details?: Record<string, unknown>;
    };
    fileUrl?: string;
    rawText?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = body.parsed ?? {};
  const destination = String(parsed.destination ?? "").trim() || String(parsed.title ?? "").trim() || "Indonesia";
  const departDate = isoDateOnly(parsed.depart_at) ?? isoDateOnly(parsed.check_in);
  const returnDate = isoDateOnly(parsed.arrive_at) ?? isoDateOnly(parsed.check_out);

  const whenBits = [departDate, returnDate && returnDate !== departDate ? `s.d. ${returnDate}` : null].filter(Boolean);
  const intake_data = {
    where: destination,
    when: whenBits.join(" ") || null,
    who: null,
    budget: null,
    vibe: null,
    pacing: "balanced",
    specialNeeds: null,
    importedBooking: true,
    importSummary: String(parsed.title ?? "Tiket diimpor"),
  };

  try {
    const { data: trip, error: tripError } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: appUser.id,
        status: "intake",
        payment_status: "paid",
        is_surprise_mode: false,
        intake_data,
        trip_start_date: departDate,
        trip_end_date: returnDate ?? departDate,
      })
      .select("id,public_id")
      .single();
    if (tripError || !trip) throw tripError ?? new Error("Gagal membuat trip.");

    const bookingType = VALID_TYPES.includes(parsed.booking_type as BookingType)
      ? (parsed.booking_type as BookingType)
      : "other";

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("trip_bookings")
      .insert({
        trip_id: (trip as { id: string }).id,
        user_id: appUser.id,
        booking_type: bookingType,
        provider: parsed.provider?.slice(0, 120) ?? null,
        booking_ref: parsed.booking_ref?.slice(0, 64) ?? null,
        title: String(parsed.title ?? "Tiket diimpor").slice(0, 200),
        origin: parsed.origin?.slice(0, 120) ?? null,
        destination: parsed.destination?.slice(0, 120) ?? null,
        depart_at: parsed.depart_at ?? null,
        arrive_at: parsed.arrive_at ?? null,
        check_in: parsed.check_in ?? null,
        check_out: parsed.check_out ?? null,
        details: { ...(parsed.details ?? {}), imported: true },
        file_url: typeof body.fileUrl === "string" ? body.fileUrl.slice(0, 500) : null,
      })
      .select("*")
      .single();
    if (bookingError) throw bookingError;

    return Response.json({ ok: true, trip, booking });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat trip dari booking.";
    return Response.json({ error: message }, { status: 500 });
  }
}
