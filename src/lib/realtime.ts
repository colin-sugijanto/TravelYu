import { createClient } from "@supabase/supabase-js";

export const isRealtimeConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function createMissingEnvClient() {
  const dummyChannel = {
    on: () => dummyChannel,
    subscribe: () => dummyChannel,
  };
  return {
    channel: () => dummyChannel,
    removeChannel: () => Promise.resolve("ok"),
  };
}

export const supabaseRealtime = isRealtimeConfigured
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : (createMissingEnvClient() as unknown as ReturnType<typeof createClient>);

export function subscribeToFlaggedQueue(callback: () => void) {
  const channel = supabaseRealtime
    .channel("admin-flagged-queue")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cs_approval_queue",
      },
      () => callback(),
    )
    .subscribe();

  return () => {
    void supabaseRealtime.removeChannel(channel);
  };
}

export function subscribeToCsChat(
  sessionId: string,
  callback: (payload: unknown) => void,
) {
  const channel = supabaseRealtime
    .channel(`cs-chat-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cs_chat_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => callback(payload),
    )
    .subscribe();

  return () => {
    void supabaseRealtime.removeChannel(channel);
  };
}
