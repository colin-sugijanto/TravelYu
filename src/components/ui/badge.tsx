import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "brand" | "neutral" | "sun" | "danger";
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  const styles: Record<NonNullable<BadgeProps["tone"]>, string> = {
    brand: "bg-[#d9efe4] text-[#136346]",
    neutral: "bg-[#edf0eb] text-[#3d5f4e]",
    sun: "bg-[#fef0d3] text-[#9c6a0f]",
    danger: "bg-[#f8d8d8] text-[#952f2f]",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        styles[tone],
        className,
      )}
      {...props}
    />
  );
}
