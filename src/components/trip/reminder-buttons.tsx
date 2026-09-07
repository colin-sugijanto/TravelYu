"use client";

import { useState } from "react";

interface ReminderButtonsProps {
  tripId: string;
  compact?: boolean;
}

const OPTIONS = [
  { type: "packing", label: "🎒 H-7 Packing", hint: "Packing list via WA/email" },
  { type: "checkin", label: "✈️ H-1 Check-in", hint: "PNR + e-ticket reminder" },
  { type: "h1", label: "🚀 H-1 Berangkat", hint: "Today Mode + cuaca" },
] as const;

/** 1-tap reminders wired to n8n (non-blocking). Works on mobile + desktop. */
export function ReminderButtons({ tripId, compact = false }: ReminderButtonsProps) {
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const send = async (type: string) => {
    if (busy) return;
    setBusy(type);
    try {
      await fetch(`/api/trip/${encodeURIComponent(tripId)}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      setSent((s) => ({ ...s, [type]: true }));
      window.setTimeout(() => setSent((s) => ({ ...s, [type]: false })), 3000);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`flex ${compact ? "flex-wrap" : "flex-col sm:flex-row"} gap-2`}>
      {OPTIONS.map((o) => (
        <button
          key={o.type}
          type="button"
          onClick={() => send(o.type)}
          disabled={busy === o.type}
          title={o.hint}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-100 disabled:opacity-60"
        >
          {sent[o.type] ? "✓ Terkirim" : busy === o.type ? "…" : o.label}
        </button>
      ))}
    </div>
  );
}
