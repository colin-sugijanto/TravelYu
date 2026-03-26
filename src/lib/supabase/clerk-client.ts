import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export async function createClerkSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const authContext = await auth();
  const sessionToken = await authContext.getToken();
  const sessionRole =
    typeof (authContext.sessionClaims as { role?: unknown } | null)?.role === "string"
      ? ((authContext.sessionClaims as { role?: string }).role ?? null)
      : null;
  const templateToken = sessionRole ? null : await authContext.getToken({ template: "supabase" });
  const token = templateToken ?? sessionToken;

  if (!token) {
    throw new Error(
      "Missing Clerk token. Configure Supabase Third-Party Auth (Clerk) and ensure a valid Clerk session or 'supabase' JWT template.",
    );
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
