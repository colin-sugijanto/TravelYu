import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  const styles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)] focus-visible:ring-[var(--ring)]",
    secondary: "bg-[var(--bg-alt)] text-[var(--text)] hover:bg-[#dfe8d8] focus-visible:ring-[var(--ring)]",
    ghost: "bg-transparent text-[var(--text)] hover:bg-[#e8efe3] focus-visible:ring-[var(--ring)]",
    danger: "bg-[var(--danger)] text-white hover:bg-[#a83232] focus-visible:ring-[var(--danger)]",
  };

  return <button className={cn(base, styles[variant], className)} {...props} />;
}
