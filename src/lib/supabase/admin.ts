import { createClient } from "@supabase/supabase-js";

function createMissingEnvClient() {
  return new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error("Supabase service role client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
        };
      },
    },
  );
}

export const supabaseAdmin =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : (createMissingEnvClient() as ReturnType<typeof createClient>);
