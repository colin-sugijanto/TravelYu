import { getCurrentAppUser } from "@/lib/auth";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

type ChatMessage = {
  role: "user" | "cs";
  content: string;
  ts: string;
};

async function resolveAccessibleTrip(tripId: string, userId: string) {
  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(
    tripId,
    "id,user_id",
  );

  if (!trip) return null;
  if (trip.user_id === userId) return trip;

  const member = await isTripMember(trip.id, userId);
  return member ? trip : null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await checkApiRateLimit(appUser.id, "trip-chat");
  if (blocked) return blocked;

  const trip = await resolveAccessibleTrip(id, appUser.id);
  if (!trip) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: session } = await supabaseAdmin
    .from("cs_chat_sessions")
    .select("id,trip_id,user_id,cs_id,status,messages,created_at,updated_at")
    .eq("trip_id", trip.id)
    .eq("user_id", appUser.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({ session: session ?? null });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { content?: string };

  const content = body.content?.trim();
  if (!content) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await checkApiRateLimit(appUser.id, "trip-chat");
  if (blocked) return blocked;

  const trip = await resolveAccessibleTrip(id, appUser.id);
  if (!trip) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin
    .from("cs_chat_sessions")
    .select("id,messages,status")
    .eq("trip_id", trip.id)
    .eq("user_id", appUser.id)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextMessage: ChatMessage = {
    role: "user",
    content,
    ts: new Date().toISOString(),
  };

  if (!existing) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("cs_chat_sessions")
      .insert({
        trip_id: trip.id,
        user_id: appUser.id,
        status: "open",
        messages: [nextMessage],
      })
      .select("id,trip_id,user_id,cs_id,status,messages,created_at,updated_at")
      .single();

    if (createError) {
      return Response.json({ error: "Failed to create chat session" }, { status: 500 });
    }

    return Response.json({ ok: true, session: created });
  }

  const currentMessages = Array.isArray(existing.messages) ? existing.messages : [];
  const nextMessages = [...currentMessages, nextMessage];

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("cs_chat_sessions")
    .update({
      messages: nextMessages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("id,trip_id,user_id,cs_id,status,messages,created_at,updated_at")
    .single();

  if (updateError) {
    return Response.json({ error: "Failed to update chat session" }, { status: 500 });
  }

  return Response.json({ ok: true, session: updated });
}
