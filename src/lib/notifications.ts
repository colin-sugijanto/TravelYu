import { after } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type NotificationChannel = "email" | "whatsapp" | "both";

type TravelYuEventType =
  | "itinerary_ready"
  | "cs_approved"
  | "trip_reminder_h1"
  | "checkin_reminder_h24"
  | "packing_reminder_h7"
  | "vendor_contact"
  | "trip_completed"
  | "post_trip_review"
  | "points_earned"
  | "cs_reply";

export interface TravelYuNotificationPayload {
  eventType: TravelYuEventType;
  tripId?: string | null;
  tripPublicId?: string | null;
  userName?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  channelPreference?: NotificationChannel | string | null;
  subject?: string | null;
  emailText?: string | null;
  waText?: string | null;
}

interface TripRecipient {
  tripId: string;
  tripPublicId: string | null;
  userName: string | null;
  email: string | null;
  phoneE164: string | null;
}

export function normalizePhoneToE164(phone: string | null | undefined): string | null {
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

  const hasEmail = Boolean(payload.email && String(payload.email).trim());
  const hasPhone = Boolean(payload.phoneE164 && String(payload.phoneE164).trim());
  if (!hasEmail && !hasPhone) {
    return { ok: false, skipped: true, reason: "missing_recipient_contact" as const };
  }

  const body = {
    event_type: payload.eventType,
    trip_id: payload.tripId ?? null,
    trip_public_id: payload.tripPublicId ?? null,
    app_base_url: process.env.NEXT_PUBLIC_APP_URL ?? "https://travelyu.vercel.app",
    user_name: payload.userName ?? "Traveler",
    email: payload.email ?? null,
    phone_e164: payload.phoneE164 ?? null,
    channel_preference: normalizeChannelPreference(payload.channelPreference, payload.email, payload.phoneE164),
    subject: payload.subject ?? null,
    email_text: payload.emailText ?? null,
    wa_text: payload.waText ?? null,
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
      signal: AbortSignal.timeout(5000),
    });

    return { ok: response.ok, skipped: false, status: response.status };
  } catch {
    return { ok: false, skipped: false, status: 0 };
  }
}

export function scheduleNotification(payload: TravelYuNotificationPayload) {
  const run = async () => {
    try {
      await sendTravelYuNotification(payload);
    } catch {
      // notification errors must never break request lifecycle
    }
  };

  try {
    after(run);
  } catch {
    // Fallback for contexts where `after()` is unavailable
    void run();
  }
}

export async function resolveTripRecipient(tripId: string): Promise<TripRecipient | null> {
  let tripQuery = await supabaseAdmin.from("trips").select("id,public_id,user_id").eq("id", tripId).maybeSingle();

  if (!tripQuery.data) {
    tripQuery = await supabaseAdmin.from("trips").select("id,public_id,user_id").eq("public_id", tripId).maybeSingle();
  }

  const trip = tripQuery.data;

  if (!trip) return null;

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("full_name,whatsapp_number,email")
    .eq("id", trip.user_id as string)
    .maybeSingle();

  const userName = (userRow?.full_name as string | null | undefined) ?? null;
  const phoneE164 = normalizePhoneToE164((userRow?.whatsapp_number as string | null | undefined) ?? null);

  const email = (userRow?.email as string | null | undefined) ?? null;

  return {
    tripId: trip.id as string,
    tripPublicId: (trip.public_id as string | null | undefined) ?? null,
    userName,
    email,
    phoneE164,
  };
}
