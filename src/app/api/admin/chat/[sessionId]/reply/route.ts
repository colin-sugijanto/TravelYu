import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const body = (await request.json()) as { content?: string };

  if (!body.content || body.content.trim().length === 0) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: session } = await supabase
    .from("cs_chat_sessions")
    .select("id,messages")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
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

  const { error } = await supabase
    .from("cs_chat_sessions")
    .update({
      cs_id: user.id,
      messages: nextMessages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
