import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentSupabaseUser } from "@/lib/auth";

type SupabaseLike = typeof supabaseAdmin;

type SupabaseWithClerkAuth = SupabaseLike & {
  auth: SupabaseLike["auth"] & {
    getUser: () => Promise<{
      data: {
        user: Awaited<ReturnType<typeof getCurrentSupabaseUser>>;
      };
      error: null;
    }>;
  };
};

export async function createClient(): Promise<SupabaseWithClerkAuth> {
  const mappedUser = await getCurrentSupabaseUser();
  const base = supabaseAdmin as SupabaseWithClerkAuth;

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === "auth") {
        const authApi = Reflect.get(target, prop, receiver) as SupabaseWithClerkAuth["auth"];
        return {
          ...authApi,
          async getUser() {
            return {
              data: {
                user: mappedUser,
              },
              error: null,
            };
          },
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseWithClerkAuth;
}
