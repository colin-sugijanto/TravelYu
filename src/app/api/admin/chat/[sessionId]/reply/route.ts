import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const body = (await request.json()) as { content?: string };

  if (!body.content || body.content.trim().length === 0) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: session } = await supabaseAdmin
    .from("cs_chat_sessions")
    .select("id,trip_id,messages,cs_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.cs_id && session.cs_id !== appUser.id) {
    // If it's already bound to a different CS and the new CS wants to override, we should probably allow it for super_admin
    // but for now, we'll keep the existing lock logic
    return Response.json({ error: "Session is handled by another CS" }, { status: 409 });
  }

  const currentMessages = Array.isArray(session.messages) ? session.messages : [];
  const nextMessages = [
    ...currentMessages,
    {
      role: "cs",
      content: body.content.trim(),
      ts: new Date().toISOString(),
    },
  ];

  const { error } = await supabaseAdmin
    .from("cs_chat_sessions")
    .update({
      cs_id: appUser.id,
      messages: nextMessages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    return Response.json({ error: "Failed to send CS reply" }, { status: 500 });
  }

  const { data: updated } = await supabaseAdmin
    .from("cs_chat_sessions")
    .select("id,trip_id,user_id,cs_id,status,messages,created_at,updated_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!updated) {
    return Response.json({ error: "Failed to load updated session" }, { status: 500 });
  }

  // Schedule notification for the user
  const recipient = await resolveTripRecipient(session.trip_id as string);
  if (recipient) {
    scheduleNotification({
      eventType: "cs_reply",
      tripId: recipient.tripId,
      tripPublicId: recipient.tripPublicId,
      userName: recipient.userName,
      email: recipient.email,
      phoneE164: recipient.phoneE164,
      channelPreference: "both",
      subject: `Tanggapan dari TravelYu Customer Success`,
      emailText: `Halo ${recipient.userName ?? "Traveler"}, agen Customer Success kami telah memberikan tanggapan: "${body.content.trim()}". Buka dashboard TravelYu untuk membalas pesan.`,
      waText: `Tim CS TravelYu membalas pesan kamu: "${body.content.trim()}". Cek dashboard untuk lanjut chat.`,
    });
  }

  return Response.json({ ok: true, session: updated });
}
