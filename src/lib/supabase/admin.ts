import { createClient, SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("supabaseAdmin (service_role) must only be imported in server code.");
}

let cachedClient: SupabaseClient | null = null;

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

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    return createMissingEnvClient() as ReturnType<typeof createClient>;
  }
  
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: fetch.bind(globalThis),
    },
  });
}

export const supabaseAdmin = cachedClient ?? (cachedClient = createSupabaseAdminClient());
