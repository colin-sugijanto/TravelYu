import type { ReactNode } from "react";

import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { AppShell } from "@/components/layout/shell";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const appUser = await getCurrentAppUser();

  let showOnboarding = false;
  if (appUser) {
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("onboarding_completed, whatsapp_number")
      .eq("id", appUser.id)
      .maybeSingle();

    const onboardingCompleted = (profile as { onboarding_completed?: boolean } | null)?.onboarding_completed ?? false;
    const hasWhatsapp = Boolean((profile as { whatsapp_number?: string | null } | null)?.whatsapp_number);
    // Show modal if onboarding not completed AND no WA number already saved
    showOnboarding = !onboardingCompleted && !hasWhatsapp;
  }

  return (
    <AppShell showAdminLink={isAdminRole(appUser?.role)}>
      {showOnboarding && <OnboardingModal />}
      {children}
    </AppShell>
  );
}
