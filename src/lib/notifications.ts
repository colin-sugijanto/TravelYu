import { supabaseAdmin } from "@/lib/supabase/admin";

type NotificationChannel = "email" | "whatsapp" | "both";

type TravelYuEventType =
  | "itinerary_ready"
  | "payment_success"
  | "payment_failed"
  | "cs_approved"
  | "trip_reminder_h1";

export interface TravelYuNotificationPayload {
  eventType: TravelYuEventType;
  tripId: string;
  userName?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  channelPreference?: NotificationChannel | string | null;
}

interface TripRecipient {
  tripId: string;
  userName: string | null;
  email: string | null;
  phoneE164: string | null;
}

function normalizePhoneToE164(phone: string | null | undefined): string | null {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `+62${digits}`;

  return `+${digits}`;
}

function normalizeChannelPreference(
  preferred: string | null | undefined,
  email: string | null | undefined,
  phone: string | null | undefined,
): NotificationChannel {
  const hasEmail = Boolean(email);
  const hasPhone = Boolean(phone);

  if (preferred === "both") {
    if (hasEmail && hasPhone) return "both";
    if (hasEmail) return "email";
    if (hasPhone) return "whatsapp";
    return "email";
  }

  if (preferred === "email") {
    if (hasEmail) return "email";
    if (hasPhone) return "whatsapp";
    return "email";
  }

  if (preferred === "whatsapp") {
    if (hasPhone) return "whatsapp";
    if (hasEmail) return "email";
    return "whatsapp";
  }

  if (email && phone) return "both";
  if (phone) return "whatsapp";
  return "email";
}

export async function sendTravelYuNotification(payload: TravelYuNotificationPayload) {
  const webhookUrl = process.env.N8N_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, skipped: true, reason: "missing_webhook_url" as const };
  }

  const body = {
    event_type: payload.eventType,
    trip_id: payload.tripId,
    user_name: payload.userName ?? "Traveler",
    email: payload.email ?? null,
    phone_e164: payload.phoneE164 ?? null,
    channel_preference: normalizeChannelPreference(payload.channelPreference, payload.email, payload.phoneE164),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.N8N_NOTIFICATION_WEBHOOK_TOKEN) {
    headers["Authorization"] = process.env.N8N_NOTIFICATION_WEBHOOK_TOKEN;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return { ok: response.ok, skipped: false, status: response.status };
  } catch {
    return { ok: false, skipped: false, status: 0 };
  }
}

export async function resolveTripRecipient(tripId: string): Promise<TripRecipient | null> {
  let tripQuery = await supabaseAdmin.from("trips").select("id,user_id").eq("id", tripId).maybeSingle();

  if (!tripQuery.data) {
    tripQuery = await supabaseAdmin.from("trips").select("id,user_id").eq("public_id", tripId).maybeSingle();
  }

  const trip = tripQuery.data;

  if (!trip) return null;

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("full_name,whatsapp_number")
    .eq("id", trip.user_id as string)
    .maybeSingle();

  const userName = (userRow?.full_name as string | null | undefined) ?? null;
  const phoneE164 = normalizePhoneToE164((userRow?.whatsapp_number as string | null | undefined) ?? null);

  let email: string | null = null;
  const authResult = await supabaseAdmin.auth.admin.getUserById(trip.user_id as string);
  if (!authResult.error) {
    email = authResult.data.user?.email ?? null;
  }

  return {
    tripId: trip.id as string,
    userName,
    email,
    phoneE164,
  };
}
