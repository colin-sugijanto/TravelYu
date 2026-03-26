import { createClerkSupabaseClient } from "@/lib/supabase/clerk-client";

export async function createClient() {
  return createClerkSupabaseClient();
}
