import { revalidateTag } from "next/cache";

import { getCurrentAppUser } from "@/lib/auth";
import { scheduleAwardPoints } from "@/lib/points";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface ProfileUpdateBody {
  full_name?: string;
  whatsapp_number?: string;
  travel_preferences?: {
    vibe?: string[];
    budget_tier?: string;
  };
}

/**
 * PATCH /api/user/profile — update authenticated user's profile fields.
 * Sets onboarding_completed = true on first save.
 * Awards 25 welcome points on first onboarding completion.
 */
export async function PATCH(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ProfileUpdateBody;
  try {
    body = (await request.json()) as ProfileUpdateBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate phone number format if provided
  const phone = body.whatsapp_number?.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) {
      return Response.json({ error: "Nomor WhatsApp tidak valid" }, { status: 400 });
    }
  }

  // Check current onboarding status
  const { data: currentProfile } = await supabaseAdmin
    .from("users")
    .select("onboarding_completed")
    .eq("id", appUser.id)
    .maybeSingle();

  const wasOnboarded = (currentProfile as { onboarding_completed?: boolean } | null)?.onboarding_completed ?? false;

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    onboarding_completed: true,
  };

  if (body.full_name?.trim()) {
    updatePayload.full_name = body.full_name.trim();
  }

  if (phone) {
    updatePayload.whatsapp_number = phone;
  }

  if (body.travel_preferences) {
    updatePayload.travel_preferences = body.travel_preferences;
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update(updatePayload)
    .eq("id", appUser.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  revalidateTag(`user:${appUser.id}:profile`, "max");

  // Award 25 welcome points on first onboarding completion
  if (!wasOnboarded) {
    scheduleAwardPoints(appUser.id, 25, "onboarding_completed", appUser.id);
  }

  return Response.json({ ok: true, firstOnboarding: !wasOnboarded });
}
