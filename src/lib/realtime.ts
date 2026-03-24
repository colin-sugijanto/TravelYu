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
