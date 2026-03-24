import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!process.env.WAHA_API_URL || !process.env.WAHA_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

  const response = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WAHA_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      chatId: vendor.whatsapp_number,
      text: body.message,
    }),
  });

  await supabaseAdmin.from("waha_message_log").insert({
    recipient_type: "vendor",
    recipient_id: vendor.id,
    message: body.message,
    status: response.ok ? "sent" : "failed",
  });

  return Response.json({ ok: response.ok });
}
