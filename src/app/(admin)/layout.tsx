import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/shell";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const appUser = await getCurrentAppUser();
  if (!appUser || !isAdminRole(appUser.role)) {
    redirect("/dashboard");
  }

  return <AppShell>{children}</AppShell>;
}
