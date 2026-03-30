import { revalidateTag } from "next/cache";

import { getCurrentAppUser } from "@/lib/auth";
import { scheduleAwardPoints } from "@/lib/points";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier } from "@/lib/trip-access";
import type { IntakeData } from "@/types/domain";

/**
 * POST /api/trip/[id]/complete — self-service trip completion by the trip owner.
 * Allowed if trip is 'approved' or 'active'.
 * Awards 100 points and schedules a post-trip notification.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{
    id: string;
    user_id: string;
    status: string;
    intake_data: IntakeData | null;
  }>(id, "id,user_id,status,intake_data");

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id) {
    return Response.json({ error: "Forbidden — only trip owner can complete a trip" }, { status: 403 });
  }

  if (trip.status === "completed") {
    return Response.json({ ok: true, unchanged: true });
  }

  if (trip.status !== "approved" && trip.status !== "active") {
    return Response.json(
      { error: "Trip harus berstatus approved atau active untuk diselesaikan." },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from("trips")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", trip.id);

  if (error) {
    return Response.json({ error: "Failed to complete trip" }, { status: 500 });
  }

  revalidateTag(`trip:${trip.id}`, "max");
  revalidateTag(`trip:${trip.id}:items`, "max");
  revalidateTag("admin:metrics", "max");

  // Award 100 points for completing a trip (fire-and-forget)
  scheduleAwardPoints(appUser.id, 100, "trip_completed", trip.id);

  // Schedule post-trip review notification
  const recipient = await resolveTripRecipient(trip.id as string);
  const destination = (trip.intake_data as Record<string, unknown> | null)?.where as string | undefined;
  if (recipient) {
    scheduleNotification({
      eventType: "post_trip_review",
      tripId: recipient.tripId,
      tripPublicId: recipient.tripPublicId,
      userName: recipient.userName,
      email: recipient.email,
      phoneE164: null, // email only for review prompt
      channelPreference: "email",
      subject: `Bagaimana tripmu ke ${destination ?? "destinasi tujuan"}?`,
      emailText: `Halo ${recipient.userName ?? "Traveler"}, trip ke ${destination ?? "destinasi tujuan"} sudah selesai! Yuk bagikan pengalamanmu di TravelYu. Kamu juga mendapat 50 poin untuk setiap ulasan yang kamu berikan.`,
    });

    scheduleNotification({
      eventType: "points_earned",
      tripId: recipient.tripId,
      tripPublicId: recipient.tripPublicId,
      userName: recipient.userName,
      email: recipient.email,
      phoneE164: recipient.phoneE164,
      channelPreference: "both",
      subject: "+100 poin trip selesai",
      emailText: "Selamat! Trip kamu selesai dan kamu mendapatkan +100 poin loyalty TravelYu.",
      waText: "Trip selesai! Kamu mendapatkan +100 poin loyalty TravelYu 🎉",
    });
  }

  return Response.json({ ok: true });
}
