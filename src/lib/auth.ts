import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

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

type SessionClaimsMap = Record<string, unknown>;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeCode = "code" in error ? error.code : undefined;
  if (maybeCode === "23505") return true;

  const maybeMessage = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";
  return maybeMessage.includes("duplicate key value") || maybeMessage.includes("unique constraint");
}

function buildDisplayName(user: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  if (user.fullName?.trim()) return user.fullName.trim();

  const joinedName = [user.firstName, user.lastName]
    .filter((part) => Boolean(part && part.trim()))
    .join(" ")
    .trim();

  if (joinedName) return joinedName;
  if (user.username?.trim()) return user.username.trim();
  return null;
}

function getClaimString(claims: SessionClaimsMap, key: string): string | null {
  const value = claims[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildProfileFromClaims(clerkId: string, claims: SessionClaimsMap) {
  const emailRaw =
    getClaimString(claims, "email") ??
    getClaimString(claims, "email_address") ??
    getClaimString(claims, "primary_email_address");

  const fullName = buildDisplayName({
    fullName: getClaimString(claims, "full_name"),
    firstName: getClaimString(claims, "given_name") ?? getClaimString(claims, "first_name"),
    lastName: getClaimString(claims, "family_name") ?? getClaimString(claims, "last_name"),
    username: getClaimString(claims, "preferred_username") ?? getClaimString(claims, "username"),
  });

  return {
    fullName,
    email: emailRaw ? normalizeEmail(emailRaw) : null,
  };
}

async function findUserByClerkId(clerkId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id,full_name,email,role,clerk_id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

async function findUserByClerkIdWithRetries(clerkId: string) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const user = await findUserByClerkId(clerkId);
    if (user) return user;

    if (attempt < maxAttempts) {
      await wait(50 * attempt);
    }
  }

  return null;
}

async function findUserByEmail(email: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id,full_name,email,role,clerk_id")
    .ilike("email", normalizeEmail(email))
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

async function claimUserByEmail(clerkId: string, fullName: string, email: string) {
  const existing = await findUserByEmail(email);
  if (!existing) return null;
  if (existing.clerk_id && existing.clerk_id !== clerkId) return null;
  if (existing.clerk_id === clerkId) return existing;

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      clerk_id: clerkId,
      full_name: existing.full_name ?? fullName,
      email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("id,full_name,email,role,clerk_id")
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) {
      const byClerkId = await findUserByClerkIdWithRetries(clerkId);
      if (byClerkId) return byClerkId;
    }
    return null;
  }

  if (data) {
    return data as AppUserRow;
  }

  return null;
}

async function createPublicUser(clerkId: string, fullName: string, email: string | null) {
  const normalizedEmail = email ? normalizeEmail(email) : null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      clerk_id: clerkId,
      full_name: fullName || null,
      email: normalizedEmail,
    })
    .select("id,full_name,email,role,clerk_id")
    .single();

  if (!error && data) {
    return data as AppUserRow;
  }

  const byClerkId = await findUserByClerkIdWithRetries(clerkId);
  if (byClerkId) return byClerkId;

  if (normalizedEmail) {
    const claimed = await claimUserByEmail(clerkId, fullName, normalizedEmail);
    if (claimed) return claimed;
  }

  if (isUniqueViolation(error)) {
    const byClerkIdAfterConflict = await findUserByClerkIdWithRetries(clerkId);
    if (byClerkIdAfterConflict) return byClerkIdAfterConflict;
  }

  throw new Error(error?.message ?? "Failed to create user profile");
}

export const getCurrentAppUser = cache(async (): Promise<AppUserContext | null> => {
  const authContext = await auth();
  const clerkId = authContext.userId;
  if (!clerkId) return null;

  const claims = (authContext.sessionClaims ?? {}) as SessionClaimsMap;
  const { fullName, email } = buildProfileFromClaims(clerkId, claims);

  let appUser = await findUserByClerkId(clerkId);

  if (!appUser && email) {
    appUser = await claimUserByEmail(clerkId, fullName ?? "", email);
  }

  if (!appUser) {
    appUser = await createPublicUser(clerkId, fullName ?? "", email);
  }

  if (!appUser) return null;

  return {
    id: appUser.id,
    clerkId,
    fullName: appUser.full_name ?? fullName,
    role: appUser.role,
    email: appUser.email ?? email,
  };
});
