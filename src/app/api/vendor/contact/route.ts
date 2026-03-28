import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { normalizePhoneToE164, scheduleNotification } from "@/lib/notifications";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!process.env.N8N_NOTIFICATION_WEBHOOK_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Vendor contact service is not configured" }, { status: 503 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const blocked = await checkApiRateLimit(appUser.id, "vendor-contact");
  if (blocked) return blocked;

  const body = (await request.json()) as {
    vendorId: string;
    message: string;
  };

  if (!body.vendorId || !body.message?.trim()) {
    return Response.json({ error: "vendorId and message are required" }, { status: 400 });
  }

  const message = body.message.trim();
  if (message.length > 2000) {
    return Response.json({ error: "message is too long" }, { status: 400 });
  }

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

  scheduleNotification({
    eventType: "vendor_contact",
    tripId: null,
    userName: "TravelYu CS",
    phoneE164,
    channelPreference: "whatsapp",
    waText: message,
  });

  await supabaseAdmin.from("waha_message_log").insert({
    recipient_type: "vendor",
    recipient_id: vendor.id,
    message,
    status: "queued",
  });

  return Response.json({ ok: true, queued: true });
}
