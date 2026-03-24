import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[#dde8dd]", className)}>
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#2f8f6b,#f6b63f)] transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
