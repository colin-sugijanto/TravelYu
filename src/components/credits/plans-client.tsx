"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { PLAN_CONFIGS, PLAN_ORDER, formatPlanPrice, type PlanConfig } from "@/lib/plans";
import type { PlanTier } from "@/types/domain";

function PlanCard({
  plan,
  current,
  pending,
  onSelect,
}: {
  plan: PlanConfig;
  current: boolean;
  pending: string | null;
  onSelect: (tier: PlanTier, cycle: "monthly" | "yearly") => void;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const price = cycle === "yearly" ? plan.priceYearlyIdr : plan.priceMonthlyIdr;
  const perMonth =
    cycle === "yearly" && plan.priceYearlyIdr > 0 ? Math.round(plan.priceYearlyIdr / 12) : price;

  return (
    <Card
      className={`flex flex-col p-5 ${plan.highlighted ? "border-amber-300 shadow-[0_20px_40px_-24px_rgba(245,158,11,0.5)]" : ""} ${current ? "ring-2 ring-emerald-400" : ""}`}
    >
      {plan.highlighted ? (
        <span className="self-start rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
          Paling Populer
        </span>
      ) : null}
      <h2 className="mt-2 text-lg font-bold">{plan.name}</h2>
      <p className="text-xs text-zinc-500">{plan.tagline}</p>

      <div className="mt-3">
        {plan.tier !== "free" ? (
          <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold">
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={`flex-1 rounded-full px-2 py-1 ${cycle === c ? "bg-white shadow" : "text-zinc-500"}`}
              >
                {c === "monthly" ? "Bulanan" : "Tahunan"}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-2xl font-extrabold">
          {formatPlanPrice(price)}
          {plan.tier !== "free" ? (
            <span className="text-xs font-medium text-zinc-500">
              {" "}
              /{cycle === "yearly" ? "tahun" : "bulan"}
              {cycle === "yearly" ? ` (≈ ${formatPlanPrice(perMonth)}/bln)` : ""}
            </span>
          ) : (
            <span className="text-xs font-medium text-zinc-500"> selamanya</span>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          ⚡ {plan.monthlyCredits} AI credits/bulan · {plan.maxActiveTrips} trip aktif
        </p>
      </div>

      <ul className="mt-3 flex-1 space-y-1.5 text-[13px] text-zinc-700">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden="true">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={current || pending !== null}
        onClick={() => onSelect(plan.tier, cycle)}
        className={`mt-4 rounded-full px-4 py-2 text-sm font-bold transition ${
          current
            ? "bg-emerald-100 text-emerald-700"
            : plan.tier === "free"
              ? "border border-slate-200 text-slate-600"
              : "bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-60"
        }`}
      >
        {current ? "Paket Aktif ✓" : pending === plan.tier ? "Memproses…" : plan.cta}
      </button>
    </Card>
  );
}

export function PlansClient({
  currentTier,
  balance,
  quota,
}: {
  currentTier: PlanTier;
  balance: number;
  quota: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const select = async (tier: PlanTier, cycle: "monthly" | "yearly") => {
    if (tier === "free") {
      setMessage("Paket Free sudah aktif secara default.");
      return;
    }
    setPending(tier);
    setMessage(null);
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, billingCycle: cycle }),
      });
      const payload = (await res.json()) as { ok?: boolean; mode?: string; message?: string; error?: string };
      if (!res.ok || !payload.ok) {
        setMessage(payload.error ?? "Checkout gagal. Coba lagi.");
        return;
      }
      setMessage(payload.message ?? "Paket aktif!");
      router.refresh();
    } catch {
      setMessage("Terjadi kesalahan. Coba lagi.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-zinc-500">
        Paket saat ini: <span className="font-bold uppercase">{PLAN_CONFIGS[currentTier].name}</span> · ⚡{" "}
        {balance}/{quota} kredit tersisa
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((tier) => (
          <PlanCard key={tier} plan={PLAN_CONFIGS[tier]} current={tier === currentTier} pending={pending} onSelect={select} />
        ))}
      </div>
      {message ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center text-xs text-zinc-600">{message}</p>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-zinc-600">
        <p className="font-bold text-zinc-800">Biaya kredit AI</p>
        <p className="mt-1">
          Intake chat 1/pesan · Komparasi 6 · Generate itinerary 25 · Editor 2/pesan · Regen hari 5 ·
          Parser tiket 3 · Packing list 2. Kredit reset tiap awal bulan. Free cocok untuk ~1 itinerary
          lengkap/bulan; Member ~10 itinerary + edit; Pro untuk trip grup intensif & kreator.
        </p>
      </div>
    </div>
  );
}
