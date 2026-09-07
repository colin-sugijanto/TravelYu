"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/trips", label: "Trips" },
  { href: "/admin/flagged", label: "Flagged Queue" },
  { href: "/admin/chat", label: "CS Chat" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/whatsapp", label: "WhatsApp" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigasi" className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        {ADMIN_LINKS.map((link) => {
          const active =
            link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
