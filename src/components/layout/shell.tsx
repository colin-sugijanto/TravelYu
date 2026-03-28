import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/header";

export function AppShell({ children, noPadding = false }: { children: ReactNode, noPadding?: boolean }) {
  return (
    <div className="page-shell min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      <AppHeader />
      {noPadding ? (
        <main className="flex-1 w-full pt-2 sm:pt-3 lg:pt-4 flex flex-col">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-7 pt-8 md:px-6 md:pb-10 md:pt-11 flex flex-col">{children}</main>
      )}
    </div>
  );
}
