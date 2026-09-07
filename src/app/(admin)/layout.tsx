import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const appUser = await getCurrentAppUser();
  if (!appUser || !isAdminRole(appUser.role)) {
    redirect("/dashboard");
  }

  return (
    <AppShell showAdminLink>
      <div className="space-y-4">
        <AdminNav />
        {children}
      </div>
    </AppShell>
  );
}
