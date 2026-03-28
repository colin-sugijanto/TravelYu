import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/shell";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const appUser = await getCurrentAppUser();
  if (!appUser || !isAdminRole(appUser.role)) {
    redirect("/dashboard");
  }

  return (
    <AppShell showAdminLink>
      <div className="space-y-4">
        <nav className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Overview
            </Link>
            <Link
              href="/admin/trips"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Trips
            </Link>
            <Link
              href="/admin/flagged"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Flagged Queue
            </Link>
            <Link
              href="/admin/chat"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              CS Chat
            </Link>
            <Link
              href="/admin/analytics"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Analytics
            </Link>
            <Link
              href="/admin/users"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Users
            </Link>
            <Link
              href="/admin/vendors"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Vendors
            </Link>
            <Link
              href="/admin/whatsapp"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              WhatsApp
            </Link>
          </div>
        </nav>
        {children}
      </div>
    </AppShell>
  );
}
