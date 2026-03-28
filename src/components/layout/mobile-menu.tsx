"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

export function MobileMenu() {
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
            <Link
              href="/dashboard"
              className={`rounded-2xl px-4 py-3 transition-all hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)] ${pathname === "/dashboard" ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-slate-800"}`}
              onClick={() => setIsOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/admin"
              className={`rounded-2xl px-4 py-3 transition-all hover:bg-[var(--brand-blue-soft)] hover:text-[var(--brand-blue)] ${pathname === "/admin" ? "bg-[var(--brand-blue-soft)] text-[var(--brand-blue)]" : "text-slate-800"}`}
              onClick={() => setIsOpen(false)}
            >
              Admin
            </Link>
            <Link
              href="/trip/new/intake"
              className={`rounded-2xl px-4 py-3 transition-all hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)] ${pathname === "/trip/new/intake" ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-slate-800"}`}
              onClick={() => setIsOpen(false)}
            >
              Rencanakan Perjalanan
            </Link>
          </nav>

          <div className="mt-auto flex flex-col gap-4 border-t border-slate-200 pt-6">
            <Link
              href="/login?next=%2Fdashboard"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-all hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
            >
              <span>Masuk</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
