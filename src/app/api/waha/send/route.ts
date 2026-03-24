import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!process.env.WAHA_API_URL || !process.env.WAHA_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "WAHA service is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    recipientType: "user" | "vendor";
    recipientId: string;
    chatId: string;
    text: string;
  };

  const response = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WAHA_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      chatId: body.chatId,
      text: body.text,
    }),
  });

  await supabaseAdmin.from("waha_message_log").insert({
    recipient_type: body.recipientType,
    recipient_id: body.recipientId,
    message: body.text,
    status: response.ok ? "sent" : "failed",
  });

  return Response.json({ ok: response.ok });
}
