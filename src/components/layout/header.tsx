import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

import { APP_NAME } from "@/lib/constants";
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)]/90 bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-base font-bold text-white">
            T
          </span>
          <div>
            <p className="text-sm font-extrabold tracking-wide text-[var(--text)]">{APP_NAME}</p>
            <p className="text-[11px] text-[var(--text-soft)]">Personal Travel Concierge</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--bg-alt)]">
            Dashboard
          </Link>
          <Link href="/trip/new" className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--bg-alt)]">
            New Trip
          </Link>
          <Link href="/admin" className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--bg-alt)]">
            Admin
          </Link>
          <Link
            href="/trip/new/intake"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
          >
            Start Planning
          </Link>
          <Show when="signed-out">
            <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--bg-alt)]"
              >
                Login
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </nav>
      </div>
    </header>
  );
}
