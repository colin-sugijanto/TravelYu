import { revalidateTag } from "next/cache";

import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

async function resolveTrip(id: string, userId: string) {
  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) return { error: Response.json({ error: "Trip not found" }, { status: 404 }) as Response, trip: null };
  if (trip.user_id !== userId) {
    const member = await isTripMember(trip.id, userId);
    if (!member) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) as Response, trip: null };
  }
  return { error: null, trip };
}

/** GET /api/trip/[id]/expenses — list group expenses for settle-up. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { error, trip } = await resolveTrip(id, appUser.id);
  if (error || !trip) return error ?? Response.json({ error: "Trip not found" }, { status: 404 });

  try {
    const { data, error: dbError } = await supabaseAdmin
      .from("trip_expenses")
      .select("*")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: true });
    if (dbError) throw dbError;
    return Response.json({ expenses: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/does not exist|relation/i.test(message)) return Response.json({ expenses: [], migrationPending: true });
    return Response.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

/** POST /api/trip/[id]/expenses — { title, amount_idr, paid_by } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { error, trip } = await resolveTrip(id, appUser.id);
  if (error || !trip) return error ?? Response.json({ error: "Trip not found" }, { status: 404 });

  let body: { title?: string; amount_idr?: number; paid_by?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim().slice(0, 200);
  const amount = Math.floor(Number(body.amount_idr ?? NaN));
  const paidBy = String(body.paid_by ?? "Saya").trim().slice(0, 80) || "Saya";
  if (!title) return Response.json({ error: "Judul pengeluaran wajib diisi." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "Nominal harus > 0." }, { status: 400 });

  try {
    const { data, error: dbError } = await supabaseAdmin
      .from("trip_expenses")
      .insert({
        trip_id: trip.id,
        user_id: appUser.id,
        title,
        amount_idr: amount,
        paid_by: paidBy,
        note: typeof body.note === "string" ? body.note.slice(0, 300) || null : null,
      })
      .select("*")
      .single();
    if (dbError) throw dbError;
    revalidateTag(`trip:${trip.id}`, "max");
    return Response.json({ ok: true, expense: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save expense";
    if (/does not exist|relation/i.test(message)) {
      return Response.json({ error: "Tabel trip_expenses belum tersedia. Jalankan migrasi 017." }, { status: 500 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/trip/[id]/expenses?expenseId=... */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const expenseId = searchParams.get("expenseId");
  if (!expenseId) return Response.json({ error: "expenseId is required" }, { status: 400 });

  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { error, trip } = await resolveTrip(id, appUser.id);
  if (error || !trip) return error ?? Response.json({ error: "Trip not found" }, { status: 404 });

  const { data: row } = await supabaseAdmin
    .from("trip_expenses")
    .select("id,user_id")
    .eq("id", expenseId)
    .eq("trip_id", trip.id)
    .maybeSingle();
  if (!row) return Response.json({ error: "Expense not found" }, { status: 404 });
  if ((row as { user_id: string }).user_id !== appUser.id && trip.user_id !== appUser.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabaseAdmin.from("trip_expenses").delete().eq("id", expenseId);
  revalidateTag(`trip:${trip.id}`, "max");
  return Response.json({ ok: true });
}
