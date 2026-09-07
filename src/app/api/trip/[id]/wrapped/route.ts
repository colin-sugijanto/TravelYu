import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

/**
 * GET /api/trip/[id]/wrapped — "TravelYu Wrapped" viral summary stats.
 * Computes days, spots, photos, est vs actual spend. No extra credits charged.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await findTripByIdentifier<{
    id: string;
    user_id: string;
    public_id: string;
    status: string;
    total_est_cost_idr: number | null;
    intake_data: Record<string, unknown> | null;
  }>(id, "id,user_id,public_id,status,total_est_cost_idr,intake_data");

  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  if (trip.user_id !== appUser.id && !isAdminRole(appUser.role)) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [itemsRes, photosRes, bookingsRes] = await Promise.all([
      supabaseAdmin.from("itinerary_items").select("id,day_number,est_cost_idr,actual_cost_idr,activity_type").eq("trip_id", trip.id),
      supabaseAdmin.from("trip_photos").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
      supabaseAdmin.from("trip_bookings").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
    ]);

    const items = (itemsRes.data as Array<{ day_number: number; est_cost_idr: number; actual_cost_idr: number | null }> | null) ?? [];
    const days = items.length > 0 ? Math.max(...items.map((i) => i.day_number)) : 0;
    const spots = items.length;
    const estTotal = items.reduce((s, i) => s + (i.est_cost_idr ?? 0), 0) || trip.total_est_cost_idr || 0;
    const actualItems = items.filter((i) => i.actual_cost_idr !== null && i.actual_cost_idr !== undefined);
    const actualTotal = actualItems.reduce((s, i) => s + (i.actual_cost_idr ?? 0), 0);
    const hasActual = actualItems.length > 0;

    const where = String((trip.intake_data as Record<string, unknown> | null)?.where ?? "Indonesia");

    return Response.json({
      publicId: trip.public_id,
      destination: where,
      days,
      spots,
      photos: photosRes.count ?? 0,
      bookings: (bookingsRes.count ?? 0) as number,
      estTotalIdr: estTotal,
      actualTotalIdr: hasActual ? actualTotal : null,
      savingsIdr: hasActual ? estTotal - actualTotal : null,
      headline: `${days} Hari di ${where} • ${spots} Spot Dijelajahi`,
      shareUrl: `/trip/s/${trip.public_id}`,
      branding: "Planned & Preserved with TravelYu",
    });
  } catch {
    return Response.json({ error: "Failed to build wrapped stats" }, { status: 500 });
  }
}
