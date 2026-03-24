import { verifyMidtransSignature } from "@/lib/payment";
import { resolveTripRecipient, sendTravelYuNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!process.env.MIDTRANS_SERVER_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Webhook verification is not configured" }, { status: 503 });
  }

  const payload = (await request.json()) as {
    order_id: string;
    status_code: string;
    gross_amount: string;
    signature_key: string;
    transaction_status: "settlement" | "capture" | "pending" | "deny" | "expire" | "cancel";
  };

  const valid = verifyMidtransSignature(payload);
  if (!valid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const paid = payload.transaction_status === "settlement" || payload.transaction_status === "capture";
  const isPending = payload.transaction_status === "pending";
  const isFailed = payload.transaction_status === "deny" || payload.transaction_status === "expire" || payload.transaction_status === "cancel";

  await supabaseAdmin
    .from("trips")
    .update({
      payment_status: paid ? "paid" : isPending ? "pending" : "failed",
      status: paid ? "paid" : "payment_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("payment_ref", payload.order_id);

  const { data: trip } = await supabaseAdmin.from("trips").select("id").eq("payment_ref", payload.order_id).maybeSingle();
  if (trip?.id) {
    const recipient = await resolveTripRecipient(trip.id);
    if (recipient && (paid || isFailed)) {
      await sendTravelYuNotification({
        eventType: paid ? "payment_success" : "payment_failed",
        tripId: recipient.tripId,
        userName: recipient.userName,
        email: recipient.email,
        phoneE164: recipient.phoneE164,
        channelPreference: "both",
      });
    }
  }

  return Response.json({ ok: true, paid });
}
