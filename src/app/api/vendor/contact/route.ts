import { normalizePhoneToE164, sendTravelYuNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!process.env.N8N_NOTIFICATION_WEBHOOK_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Vendor contact service is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    vendorId: string;
    message: string;
  };

  const { data: vendor } = await supabaseAdmin
    .from("vendors")
    .select("id,whatsapp_number")
    .eq("id", body.vendorId)
    .single();

  if (!vendor?.whatsapp_number) {
    return Response.json({ error: "Vendor WhatsApp not found" }, { status: 400 });
  }

  const phoneE164 = normalizePhoneToE164(vendor.whatsapp_number);
  if (!phoneE164) {
    return Response.json({ error: "Vendor WhatsApp format is invalid" }, { status: 400 });
  }

  const result = await sendTravelYuNotification({
    eventType: "vendor_contact",
    tripId: null,
    userName: "TravelYu CS",
    phoneE164,
    channelPreference: "whatsapp",
    waText: body.message,
  });

  await supabaseAdmin.from("waha_message_log").insert({
    recipient_type: "vendor",
    recipient_id: vendor.id,
    message: body.message,
    status: result.ok ? "sent" : "failed",
  });

  return Response.json({ ok: result.ok });
}
