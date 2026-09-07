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

/** "TravelYu Wrapped" — viral card + downloadable share image (SVG) + copy link. */
export function WrappedCard({ tripId }: { tripId: string }) {
  const [data, setData] = useState<WrappedPayload | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copyLink = async () => {
    if (!data) return;
    const url = `${window.location.origin}${data.shareUrl}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable
    }
  };

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
          {data.bookings > 0 ? ` · 🎫 ${data.bookings} tiket asli` : ""}
        </p>
        {data.savingsIdr !== null && data.savingsIdr >= 0 ? (
          <p className="mt-0.5 text-[13px] font-bold">Hemat {formatIdr(data.savingsIdr)} 🎉</p>
        ) : null}
        <p className="mt-2 text-[11px] opacity-80">{data.branding}</p>
      </div>
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">Bagikan ke IG Story / WhatsApp Status</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/trip/${encodeURIComponent(tripId)}/wrapped-image`}
            download={`travelyu-wrapped-${tripId}.svg`}
            className="rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1.5 text-xs font-bold text-white"
          >
            ⬇ Download gambar
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            {copied ? "✓ Link disalin" : "Salin link share"}
          </button>
          <Link
            href={data.shareUrl}
            target="_blank"
            className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white"
          >
            Buka Link Share
          </Link>
        </div>
      </div>
    </Card>
  );
}
