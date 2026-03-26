import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "brand" | "neutral" | "sun" | "danger" | "blue";
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  const styles: Record<NonNullable<BadgeProps["tone"]>, string> = {
    brand: "bg-orange-100 text-[var(--brand-strong)]",
    neutral: "bg-slate-100 text-slate-600",
    sun: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-[var(--brand-blue-strong)]",
    danger: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
        styles[tone],
        className,
      )}
      {...props}
    />
  );
}
