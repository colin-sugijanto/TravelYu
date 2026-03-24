import { supabaseAdmin } from "@/lib/supabase/admin";

interface WahaMessagePayload {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string };
  videoMessage?: { caption?: string };
  buttonsResponseMessage?: { selectedDisplayText?: string };
  listResponseMessage?: { title?: string };
  templateButtonReplyMessage?: { selectedDisplayText?: string };
  interactiveResponseMessage?: { body?: { text?: string } };
}

function extractMessageText(message: WahaMessagePayload | null | undefined): string {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    message?.buttonsResponseMessage?.selectedDisplayText ??
    message?.listResponseMessage?.title ??
    message?.templateButtonReplyMessage?.selectedDisplayText ??
    message?.interactiveResponseMessage?.body?.text ??
    ""
  );
}

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ ok: true });
  }

  const body = await request.json();
  const eventName = String(body?.event ?? "");
  const key = body?.data?.key;
  const fromMe = Boolean(key?.fromMe);
  const remoteJid = String(key?.remoteJid ?? body?.sender ?? "unknown");
  const messageText = extractMessageText(body?.data?.message);

  const status = eventName === "messages.upsert" && !fromMe ? "received" : "sent";

  await supabaseAdmin.from("waha_message_log").insert({
    recipient_type: "vendor",
    recipient_id: remoteJid,
    message: messageText,
    status,
  });

  return Response.json({ ok: true });
}
