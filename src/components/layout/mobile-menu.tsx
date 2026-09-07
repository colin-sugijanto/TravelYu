"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { ClerkLoaded, ClerkLoading, Show, UserButton } from "@clerk/nextjs";
import { CreditBadge } from "@/components/credits/credit-badge";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trip/new", label: "Rencanakan Perjalanan" },
  { href: "/profile", label: "Profil & Passport" },
  { href: "/plans", label: "Paket & Kredit" },
  { href: "/referral", label: "Referral" },
];

export function MobileMenu({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        className="relative z-50 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-700 transition-all hover:border-[var(--brand)] hover:text-[var(--brand-strong)] md:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle mobile menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 bg-[radial-gradient(circle_at_80%_0%,rgba(249,115,22,0.14),transparent_42%),radial-gradient(circle_at_10%_100%,rgba(37,99,235,0.16),transparent_46%),#fff] px-6 pb-6 pt-24 md:hidden">
          <nav className="flex flex-col gap-3 rounded-3xl border border-white/80 bg-white/88 p-5 text-base font-semibold shadow-[0_22px_50px_-34px_rgba(15,23,42,0.52)] backdrop-blur">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-2xl px-4 py-3 transition-all hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)] ${pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href)) ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-slate-800"}`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {showAdminLink ? (
              <Link
                href="/admin"
                className={`rounded-2xl px-4 py-3 transition-all hover:bg-[var(--brand-blue-soft)] hover:text-[var(--brand-blue)] ${pathname === "/admin" || pathname.startsWith("/admin") ? "bg-[var(--brand-blue-soft)] text-[var(--brand-blue)]" : "text-slate-800"}`}
                onClick={() => setIsOpen(false)}
              >
                Admin
              </Link>
            ) : null}
          </nav>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-5">
            <ClerkLoading>
              <div className="h-8 w-full animate-pulse rounded-full bg-slate-100" aria-hidden="true" />
            </ClerkLoading>
            <ClerkLoaded>
              <Show when="signed-out">
                <Link
                  href="/login?next=%2Fdashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-700"
                  onClick={() => setIsOpen(false)}
                >
                  <span>Masuk / Daftar</span>
                </Link>
              </Show>
              <Show when="signed-in">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <CreditBadge />
                  <UserButton />
                </div>
              </Show>
            </ClerkLoaded>
          </div>
        </div>
      )}
    </>
  );
}
