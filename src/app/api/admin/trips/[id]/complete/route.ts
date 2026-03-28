import { revalidateTag } from "next/cache";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { scheduleAwardPoints } from "@/lib/points";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/admin/trips/[id]/complete — Admin marks a trip as completed.
 * Awards 100 points to the trip owner and schedules a post-trip notification.
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
    .select("id,user_id,status,intake_data")
    .eq("id", id)
    .maybeSingle();

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.status === "completed") {
    return Response.json({ ok: true, unchanged: true });
  }

  const { error } = await supabaseAdmin
    .from("trips")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  revalidateTag(`trip:${id}`, "max");
  revalidateTag(`trip:${id}:items`, "max");
  revalidateTag("admin:metrics", "max");

  // Award 100 points to trip owner
  const ownerId = trip.user_id as string;
  scheduleAwardPoints(ownerId, 100, "trip_completed", id);

  // Schedule post-trip notification
  const recipient = await resolveTripRecipient(id);
  const destination = (trip.intake_data as Record<string, unknown> | null)?.where as string | undefined;
  if (recipient) {
    scheduleNotification({
      eventType: "trip_completed",
      tripId: id,
      userName: recipient.userName,
      email: recipient.email,
      phoneE164: null,
      channelPreference: "email",
      subject: `Bagaimana tripmu ke ${destination ?? "destinasi tujuan"}?`,
      emailText: `Halo ${recipient.userName ?? "Traveler"}, tripmu sudah ditandai selesai! Bagikan pengalamanmu dan dapatkan 50 poin untuk tiap ulasan.`,
    });

    scheduleNotification({
      eventType: "points_earned",
      tripId: id,
      userName: recipient.userName,
      email: recipient.email,
      phoneE164: recipient.phoneE164,
      channelPreference: "both",
      subject: "+100 poin trip selesai",
      emailText: "Trip kamu berhasil ditandai selesai dan +100 poin loyalty sudah ditambahkan.",
      waText: "Trip selesai! +100 poin loyalty TravelYu sudah masuk ke akun kamu 🎉",
    });
  }

  return Response.json({ ok: true });
}
