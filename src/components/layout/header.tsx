"use client";

import Link from "next/link";
import Image from "next/image";
import { ClerkLoaded, ClerkLoading, Show, UserButton } from "@clerk/nextjs";
import { MobileMenu } from "./mobile-menu";

export function AppHeader() {
  return (
    <header className="sticky top-3 z-50 w-full px-3 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between rounded-[1.55rem] border border-white/80 bg-white/84 px-3 py-2 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.48)] backdrop-blur-md sm:px-5 lg:px-7">
        <div className="flex items-center gap-3 md:gap-7 lg:gap-10">
          <MobileMenu />

          <Link href="/" className="inline-flex items-center group relative z-50">
            <Image
              src="/logo.png"
              alt="Travel Yu Logo"
              width={260}
              height={75}
              className="h-11 w-auto object-contain mix-blend-multiply transition-transform group-hover:scale-[1.02] sm:h-12 md:h-14"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <Link
              href="/dashboard"
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]"
            >
              Dashboard
            </Link>
            <Link
              href="/admin"
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-[var(--brand-blue-soft)] hover:text-[var(--brand-blue)]"
            >
              Admin
            </Link>
            <Link
              href="/trip/new/intake"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-800 transition-all hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]"
            >
              Rencanakan Perjalanan
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <ClerkLoading>
            <div className="h-8 w-8" aria-hidden="true" />
          </ClerkLoading>

          <ClerkLoaded>
            <Show when="signed-out">
              <Link
                href="/login?next=%2Fdashboard"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-all hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
              >
                Masuk
              </Link>
            </Show>

            <Show when="signed-in">
              <div className="border-l border-slate-200 pl-2 md:pl-4">
                <UserButton />
              </div>
            </Show>
          </ClerkLoaded>
        </div>
      </div>
    </header>
  );
}
