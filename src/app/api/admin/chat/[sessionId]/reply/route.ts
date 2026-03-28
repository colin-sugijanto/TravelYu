import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
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
    .select("id,messages,cs_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.cs_id && session.cs_id !== appUser.id) {
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
    return Response.json({ error: error.message }, { status: 500 });
  }

  const { data: updated } = await supabaseAdmin
    .from("cs_chat_sessions")
    .select("id,trip_id,user_id,cs_id,status,messages,created_at,updated_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!updated) {
    return Response.json({ error: "Failed to load updated session" }, { status: 500 });
  }

  return Response.json({ ok: true, session: updated });
}
