import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCreditState } from "@/lib/credits";
import { getPlanConfig } from "@/lib/plans";

/** Checks whether the user may create another active trip under their plan. */
export async function checkTripCreationAllowed(userId: string): Promise<{ ok: true } | { ok: false; error: string; limit: number; current: number }> {
  const state = await getCreditState(userId);
  const config = getPlanConfig(state.planTier);

  try {
    const { count } = await supabaseAdmin
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("status", "in", "(completed,cancelled)");

    const current = count ?? 0;
    if (current >= config.maxActiveTrips) {
      return {
        ok: false,
        error: `Batas ${config.maxActiveTrips} trip aktif untuk paket ${config.name}. Selesaikan atau hapus trip lama, atau upgrade paket.`,
        limit: config.maxActiveTrips,
        current,
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/** Checks photo upload quota per trip (plan-aware, falls back to allow). */
export async function checkPhotoUploadAllowed(tripId: string, userId: string) {
  const state = await getCreditState(userId);
  const config = getPlanConfig(state.planTier);

  try {
    const { count } = await supabaseAdmin
      .from("trip_photos")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId);

    const current = count ?? 0;
    if (current >= config.maxPhotosPerTrip) {
      return {
        ok: false as const,
        error: `Batas ${config.maxPhotosPerTrip} foto per trip untuk paket ${config.name}. Upgrade ke Member/Pro untuk scrapbook lebih besar.`,
        limit: config.maxPhotosPerTrip,
        current,
      };
    }
    return { ok: true as const };
  } catch {
    return { ok: true as const };
  }
}

/** Checks booking locker quota per trip. */
export async function checkBookingCreationAllowed(tripId: string, userId: string) {
  const state = await getCreditState(userId);
  const config = getPlanConfig(state.planTier);

  try {
    const { count } = await supabaseAdmin
      .from("trip_bookings")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId);

    const current = count ?? 0;
    if (current >= config.maxBookingsPerTrip) {
      return {
        ok: false as const,
        error: `Batas ${config.maxBookingsPerTrip} booking per trip untuk paket ${config.name}.`,
        limit: config.maxBookingsPerTrip,
        current,
      };
    }
    return { ok: true as const };
  } catch {
    // Table may not exist yet (migration pending) → allow
    return { ok: true as const };
  }
}
