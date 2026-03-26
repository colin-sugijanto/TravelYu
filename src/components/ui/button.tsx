import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "blue";
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  const styles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)] focus-visible:ring-[var(--brand)] shadow-sm hover:shadow",
    blue: "bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-strong)] focus-visible:ring-[var(--brand-blue)] shadow-sm hover:shadow",
    secondary: "bg-[var(--bg-alt)] text-[var(--text)] hover:bg-slate-200 focus-visible:ring-[var(--text-soft)]",
    ghost: "bg-transparent text-[var(--text)] hover:bg-[var(--bg-alt)] focus-visible:ring-[var(--text-soft)]",
    danger: "bg-[var(--danger)] text-white hover:bg-red-600 focus-visible:ring-[var(--danger)]",
  };

  return <button className={cn(base, styles[variant], className)} {...props} />;
}
