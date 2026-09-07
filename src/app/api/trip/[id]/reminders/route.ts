import { getCurrentAppUser } from "@/lib/auth";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

const REMINDER_COPY: Record<string, { subject: string; emailText: string; waText: string; eventType: "checkin_reminder_h24" | "packing_reminder_h7" | "trip_reminder_h1" }> = {
  checkin: {
    subject: "H-1 Check-in: siapkan PNR & e-ticket",
    emailText: "Besok berangkat! Buka Ticket Locker TravelYu untuk salin PNR dan check-in online maskapai/KAI sekarang.",
    waText: "✈️ Besok berangkat! Buka TravelYu → Ticket Locker untuk check-in & salin PNR. Safe flight!",
    eventType: "checkin_reminder_h24",
  },
  packing: {
    subject: "H-7 Packing: cek Packing List AI",
    emailText: "Trip seminggu lagi! Buka Packing List AI di TravelYu dan cicil barang bawaan dari sekarang.",
    waText: "🎒 Trip 7 hari lagi! Buka Packing List di TravelYu yuk, cicil dari sekarang.",
    eventType: "packing_reminder_h7",
  },
  h1: {
    subject: "Besok berangkat — itinerary & cuaca siap",
    emailText: "Trip besok! Cek Today Mode, cuaca, dan alamat penjemputan di TravelYu.",
    waText: "🚀 Besok berangkat! Cek Today Mode + cuaca di TravelYu. Have fun!",
    eventType: "trip_reminder_h1",
  },
};

/**
 * POST /api/trip/[id]/reminders — trigger H-7 / H-1 / check-in reminders via n8n.
 * Body: { type: "checkin" | "packing" | "h1" }
 * Seamless: 1-tap from workspace/Today Mode, non-blocking.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string; public_id: string }>(
    id,
    "id,user_id,public_id",
  );
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  if (trip.user_id !== appUser.id) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { type?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const copy = REMINDER_COPY[String(body.type ?? "")];
  if (!copy) return Response.json({ error: "Tipe reminder tidak valid (checkin/packing/h1)." }, { status: 400 });

  const recipient = await resolveTripRecipient(trip.id);
  if (!recipient) return Response.json({ error: "Trip recipient not found" }, { status: 404 });

  // Persist intent for audit (best-effort, no schema dependency)
  try {
    const { data: row } = await supabaseAdmin.from("trips").select("intake_data").eq("id", trip.id).maybeSingle();
    const intake = ((row?.intake_data as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    const log = Array.isArray(intake.reminderLog) ? (intake.reminderLog as Array<Record<string, unknown>>) : [];
    log.push({ type: body.type, ts: new Date().toISOString(), by: appUser.id });
    await supabaseAdmin
      .from("trips")
      .update({ intake_data: { ...intake, reminderLog: log.slice(-20) } })
      .eq("id", trip.id);
  } catch {
    // non-critical
  }

  scheduleNotification({
    eventType: copy.eventType,
    tripId: recipient.tripId,
    tripPublicId: recipient.tripPublicId,
    userName: recipient.userName,
    email: recipient.email,
    phoneE164: recipient.phoneE164,
    channelPreference: "both",
    subject: copy.subject,
    emailText: copy.emailText,
    waText: copy.waText,
  });

  return Response.json({ ok: true, type: body.type });
}
