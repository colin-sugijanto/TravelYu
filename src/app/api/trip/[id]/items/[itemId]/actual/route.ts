import { revalidateTag } from "next/cache";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

/**
 * PATCH /api/trip/[id]/items/[itemId]/actual — "Actual vs Estimated" quick expense input.
 * Body: { actual_cost_idr: number | null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

  if (trip.user_id !== appUser.id && !isAdminRole(appUser.role)) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { actual_cost_idr?: number | null };
  try {
    body = (await request.json()) as { actual_cost_idr?: number | null };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const actual = body.actual_cost_idr;
  if (actual !== null && actual !== undefined) {
    if (!Number.isFinite(actual) || actual < 0 || actual > 1_000_000_000) {
      return Response.json({ error: "Nominal aktual tidak valid." }, { status: 400 });
    }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("itinerary_items")
      .update({ actual_cost_idr: actual ?? null, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("trip_id", trip.id)
      .select("id,actual_cost_idr")
      .single();

    if (error) throw error;
    revalidateTag(`trip:${trip.id}:items`, "max");
    return Response.json({ ok: true, item: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save actual cost";
    if (/does not exist|column/i.test(message)) {
      return Response.json(
        { error: "Kolom actual_cost_idr belum tersedia. Jalankan migrasi 014." },
        { status: 500 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
