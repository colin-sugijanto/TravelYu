import { revalidateTag } from "next/cache";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { scheduleAwardPoints } from "@/lib/points";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/admin/trips/[id]/approve — Admin approves a draft trip.
 * Awards 100 points to the trip owner and fires the itinerary_ready notification.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id,user_id,status")
    .eq("id", id)
    .maybeSingle();

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.status !== "draft") {
    return Response.json({ ok: true, unchanged: true });
  }

  const { error } = await supabaseAdmin
    .from("trips")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  revalidateTag(`trip:${id}`, "max");
  revalidateTag(`trip:${id}:items`, "max");
  revalidateTag("admin:metrics", "max");

  // Award 100 points to trip owner on approval
  const ownerId = trip.user_id as string;
  scheduleAwardPoints(ownerId, 100, "trip_approved", id);

  // Fire itinerary_ready notification
  const recipient = await resolveTripRecipient(id);
  if (recipient) {
    scheduleNotification({
      eventType: "itinerary_ready",
      tripId: recipient.tripId,
      tripPublicId: recipient.tripPublicId,
      userName: recipient.userName,
      email: recipient.email,
      phoneE164: recipient.phoneE164,
      channelPreference: "both",
    });
  }

  return Response.json({ ok: true });
}
