import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/header";

export function AppShell({ children, noPadding = false }: { children: ReactNode, noPadding?: boolean }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      <AppHeader />
      {noPadding ? (
        <main className="flex-1 w-full flex flex-col">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8 flex flex-col">{children}</main>
      )}
    </div>
  );
}
