import { getCurrentAppUser } from "@/lib/auth";
import { getCreditState } from "@/lib/credits";
import { getPlanConfig } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/credits/balance — current plan + AI credit balance + recent usage. */
export async function GET() {
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const state = await getCreditState(appUser.id);
  const config = getPlanConfig(state.planTier);

  let recentUsage: Array<{ endpoint: string; credits_charged: number; created_at: string }> = [];
  try {
    const { data } = await supabaseAdmin
      .from("ai_usage_log")
      .select("endpoint,credits_charged,created_at")
      .eq("user_id", appUser.id)
      .order("created_at", { ascending: false })
      .limit(10);
    recentUsage = (data as typeof recentUsage) ?? [];
  } catch {
    recentUsage = [];
  }

  return Response.json({
    planTier: state.planTier,
    planName: config.name,
    balance: state.balance,
    quota: state.quota,
    period: state.period,
    expiresAt: state.expiresAt,
    limits: {
      maxActiveTrips: config.maxActiveTrips,
      maxPhotosPerTrip: config.maxPhotosPerTrip,
      maxBookingsPerTrip: config.maxBookingsPerTrip,
      maxGroupMembers: config.maxGroupMembers,
    },
    recentUsage,
    upgradeUrl: "/plans",
  });
}
