"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BalancePayload = {
  planTier: "free" | "member" | "pro";
  planName: string;
  balance: number;
  quota: number;
};

/** Header pill showing plan + remaining AI credits. Gracefully hides when unavailable. */
export function CreditBadge() {
  const [data, setData] = useState<BalancePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/credits/balance")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.planTier) setData(payload as BalancePayload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const low = data.balance <= 5;
  const tierColor =
    data.planTier === "pro"
      ? "border-purple-300 bg-purple-50 text-purple-700"
      : data.planTier === "member"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <Link
      href="/plans"
      title={`${data.planName} · ${data.balance}/${data.quota} AI credits`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:shadow-sm ${tierColor}`}
    >
      <span className="uppercase tracking-wide">{data.planName}</span>
      <span aria-hidden="true">·</span>
      <span className={low ? "font-bold text-red-600" : undefined}>
        ⚡ {data.balance}/{data.quota}
      </span>
    </Link>
  );
}
