"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";

type WrappedPayload = {
  destination: string;
  days: number;
  spots: number;
  photos: number;
  bookings: number;
  estTotalIdr: number;
  actualTotalIdr: number | null;
  savingsIdr: number | null;
  headline: string;
  shareUrl: string;
  branding: string;
};

/** "TravelYu Wrapped" — 9:16-ish viral card for completed trips. */
export function WrappedCard({ tripId }: { tripId: string }) {
  const [data, setData] = useState<WrappedPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/trip/${encodeURIComponent(tripId)}/wrapped`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.headline) setData(payload as WrappedPayload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  if (!data) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600 p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">TravelYu Wrapped ✨</p>
        <h3 className="mt-1 text-xl font-extrabold leading-tight">{data.headline}</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Hari", value: String(data.days) },
            { label: "Spot", value: String(data.spots) },
            { label: "Foto", value: String(data.photos) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
              <p className="text-lg font-extrabold">{s.value}</p>
              <p className="text-[11px] opacity-80">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px]">
          Estimasi {formatIdr(data.estTotalIdr)}
          {data.actualTotalIdr !== null ? ` · Aktual ${formatIdr(data.actualTotalIdr)}` : ""}
        </p>
        {data.savingsIdr !== null && data.savingsIdr >= 0 ? (
          <p className="mt-0.5 text-[13px] font-bold">Hemat {formatIdr(data.savingsIdr)} 🎉</p>
        ) : null}
        <p className="mt-2 text-[11px] opacity-80">{data.branding}</p>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-zinc-500">Bagikan ke IG Story / WhatsApp Status</p>
        <Link
          href={data.shareUrl}
          target="_blank"
          className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white"
        >
          Buka Link Share
        </Link>
      </div>
    </Card>
  );
}
