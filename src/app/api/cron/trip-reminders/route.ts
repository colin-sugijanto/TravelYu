import { resolveTripRecipient, sendTravelYuNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/cron/trip-reminders
 *
 * Vercel cron job (runs daily at 09:00 WIB = 02:00 UTC).
 * Sends H-1 reminders for all active trips that start tomorrow.
 * Also auto-completes active trips whose end date has passed.
 *
 * Secured via CRON_SECRET header.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0]!;
  const todayStr = today.toISOString().split("T")[0]!;

  // 1. Send H-1 reminders for trips starting tomorrow
  const { data: upcomingTrips } = await supabaseAdmin
    .from("trips")
    .select("id, user_id, trip_start_date")
    .eq("status", "active")
    .eq("trip_start_date", tomorrowStr);

  let remindersCount = 0;
  for (const trip of upcomingTrips ?? []) {
    const recipient = await resolveTripRecipient(trip.id as string);
    if (recipient) {
      await sendTravelYuNotification({
        eventType: "trip_reminder_h1",
        tripId: trip.id as string,
        userName: recipient.userName,
        email: recipient.email,
        phoneE164: recipient.phoneE164,
        channelPreference: "both",
        subject: "Besok tripmu mulai! 🎒",
        emailText: `Halo ${recipient.userName ?? "Traveler"}, tripmu mulai besok! Jangan lupa cek packing list dan itinerary di TravelYu.`,
        waText: `Halo ${recipient.userName ?? "Traveler"}! 👋 Tripmu mulai *besok*! Yuk cek itinerary dan packing list di TravelYu sebelum berangkat. Selamat berlibur! 🌴`,
      });
      remindersCount++;
    }
  }

  // 2. Auto-complete active trips whose end date has passed
  const { data: expiredTrips } = await supabaseAdmin
    .from("trips")
    .select("id, user_id, trip_end_date")
    .eq("status", "active")
    .lt("trip_end_date", todayStr);

  let completedCount = 0;
  for (const trip of expiredTrips ?? []) {
    await supabaseAdmin
      .from("trips")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", trip.id as string);

    // Award completion points
    await supabaseAdmin.rpc("apply_points_event", {
      p_user_id: trip.user_id,
      p_points_delta: 100,
      p_event_type: "trip_completed",
      p_reference_id: trip.id as string,
    });

    completedCount++;
  }

  return Response.json({
    ok: true,
    reminders_sent: remindersCount,
    auto_completed: completedCount,
    date: todayStr,
  });
}
