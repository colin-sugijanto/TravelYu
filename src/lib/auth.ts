import { auth, clerkClient } from "@clerk/nextjs/server";
import type { User } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/domain";

type AppUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  clerk_id: string | null;
};

export interface AppUserContext {
  id: string;
  clerkId: string;
  fullName: string | null;
  role: UserRole;
  email: string | null;
}

export function isAdminRole(role: UserRole | null | undefined) {
  return role === "admin" || role === "super_admin";
}

function extractPrimaryEmail(clerkUser: {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
}) {
  return (
    clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null
  );
}

function buildDisplayName(clerkUser: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}) {
  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (clerkUser.username) return clerkUser.username;
  return "Traveler";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findUserByClerkId(clerkId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id,full_name,email,role,clerk_id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

async function findUserByEmail(email: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id,full_name,email,role,clerk_id")
    .ilike("email", normalizeEmail(email))
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

async function findAuthUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) return null;

    const matched = data.users.find((user) => (user.email ? normalizeEmail(user.email) : "") === normalized) ?? null;
    if (matched) return matched;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

async function ensurePublicUserRow(userId: string, clerkId: string, fullName: string, email: string | null) {
  const { error } = await supabaseAdmin.from("users").upsert(
    {
      id: userId,
      clerk_id: clerkId,
      full_name: fullName,
      email,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function ensureShadowUser(clerkId: string, fullName: string, email: string | null) {
  const fallbackEmail = `clerk+${clerkId}@travelyu.local`;
  const authEmail = email ? normalizeEmail(email) : fallbackEmail;

  if (email) {
    const existingAuthUser = await findAuthUserByEmail(authEmail);
    if (existingAuthUser) {
      await ensurePublicUserRow(existingAuthUser.id, clerkId, fullName, authEmail);
      return existingAuthUser.id;
    }
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
    app_metadata: {
      provider: "clerk",
      clerk_id: clerkId,
    },
  });

  if (createError || !created.user) {
    const existingByEmail = await findUserByEmail(authEmail);
    if (existingByEmail) {
      await supabaseAdmin
        .from("users")
        .update({
          clerk_id: clerkId,
          full_name: fullName,
          email: authEmail,
        })
        .eq("id", existingByEmail.id);

      return existingByEmail.id;
    }

    const existingAuthUser = await findAuthUserByEmail(authEmail);
    if (existingAuthUser) {
      await ensurePublicUserRow(existingAuthUser.id, clerkId, fullName, authEmail);
      return existingAuthUser.id;
    }

    throw new Error(createError?.message ?? "Failed to create shadow auth user");
  }

  const shadowUserId = created.user.id;
  await ensurePublicUserRow(shadowUserId, clerkId, fullName, authEmail);

  return shadowUserId;
}

async function loadOrCreateAppUser(clerkId: string, fullName: string, email: string | null) {
  let appUser = await findUserByClerkId(clerkId);

  if (!appUser && email) {
    appUser = await findUserByEmail(email);
  }

  if (!appUser) {
    const shadowUserId = await ensureShadowUser(clerkId, fullName, email);
    const { data } = await supabaseAdmin
      .from("users")
      .select("id,full_name,email,role,clerk_id")
      .eq("id", shadowUserId)
      .single();
    appUser = (data as AppUserRow | null) ?? null;
  }

  if (!appUser) return null;

  const normalizedEmail = email ? normalizeEmail(email) : appUser.email;
  const needUpdate = !appUser.clerk_id || appUser.full_name !== fullName || appUser.email !== normalizedEmail;

  if (needUpdate) {
    await supabaseAdmin
      .from("users")
      .update({
        clerk_id: clerkId,
        full_name: fullName,
        email: normalizedEmail,
      })
      .eq("id", appUser.id);

    appUser = {
      ...appUser,
      clerk_id: clerkId,
      full_name: fullName,
      email: normalizedEmail,
    };
  }

  return appUser;
}

export async function getCurrentAppUser(): Promise<AppUserContext | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  const email = extractPrimaryEmail(clerkUser);
  const fullName = buildDisplayName(clerkUser);

  const appUser = await loadOrCreateAppUser(clerkId, fullName, email);
  if (!appUser) return null;

  return {
    id: appUser.id,
    clerkId,
    fullName,
    role: appUser.role,
    email: email ? normalizeEmail(email) : appUser.email,
  };
}

export async function getCurrentSupabaseUser(): Promise<User | null> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return null;

  return {
    id: appUser.id,
    aud: "authenticated",
    role: "authenticated",
    email: appUser.email ?? undefined,
    phone: undefined,
    app_metadata: {
      provider: "clerk",
      clerk_id: appUser.clerkId,
    },
    user_metadata: {
      full_name: appUser.fullName,
      clerk_id: appUser.clerkId,
    },
    identities: [],
    factors: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
}
