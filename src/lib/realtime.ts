import { createClient } from "@supabase/supabase-js";

function createMissingEnvClient() {
  return new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error("Supabase realtime client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        };
      },
    },
  );
}

export const supabaseRealtime =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : (createMissingEnvClient() as ReturnType<typeof createClient>);

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
