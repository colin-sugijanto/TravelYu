import { revalidateTag } from "next/cache";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Awards points to a user by calling the apply_points_event RPC.
 * Fire-and-forget — does not block the response.
 */
export async function awardPoints(
  userId: string,
  pointsDelta: number,
  eventType: string,
  referenceId?: string,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("apply_points_event", {
      p_user_id: userId,
      p_points_delta: pointsDelta,
      p_event_type: eventType,
      p_reference_id: referenceId ?? null,
    });

    if (error) {
      console.error("[awardPoints] RPC error:", error.message);
      return;
    }

    revalidateTag(`user:${userId}:profile`, "max");
  } catch (err) {
    console.error("[awardPoints] Unexpected error:", err);
  }
}

/**
 * Schedules a points award after the current request completes.
 * Wraps awardPoints in a try/catch to ensure it never breaks the response.
 */
export function scheduleAwardPoints(
  userId: string,
  pointsDelta: number,
  eventType: string,
  referenceId?: string,
): void {
  // Fire-and-forget — intentionally not awaited
  void awardPoints(userId, pointsDelta, eventType, referenceId).catch(() => {
    // swallow errors so they never propagate
  });
}
