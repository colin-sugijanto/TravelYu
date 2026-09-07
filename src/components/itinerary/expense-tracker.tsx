"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";
import type { ItineraryItem } from "@/types/domain";

interface ExpenseTrackerProps {
  tripId: string;
  items: ItineraryItem[];
  canEdit?: boolean;
}

/** "Actual vs Estimated" quick expense tracker (Member+ flagship, Free read-only summary). */
export function ExpenseTracker({ tripId, items, canEdit = true }: ExpenseTrackerProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { estTotal, actualTotal, withActual } = useMemo(() => {
    const est = items.reduce((s, i) => s + (i.est_cost_idr ?? 0), 0);
    const flagged = items.filter((i) => i.actual_cost_idr !== null && i.actual_cost_idr !== undefined);
    return { estTotal: est, actualTotal: flagged.reduce((s, i) => s + (i.actual_cost_idr ?? 0), 0), withActual: flagged.length };
  }, [items]);

  const hasActual = withActual > 0;
  const diff = estTotal - actualTotal;

  const save = async (itemId: string) => {
    const raw = (drafts[itemId] ?? "").replace(/[^0-9]/g, "");
    if (!raw) return;
    setSaving(itemId);
    try {
      const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/items/${encodeURIComponent(itemId)}/actual`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual_cost_idr: Number(raw) }),
      });
      if (res.ok) {
        setDrafts((d) => ({ ...d, [itemId]: "" }));
        router.refresh();
      }
    } finally {
      setSaving(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <Card className="p-5">
      <CardTitle>💰 Actual vs Estimasi</CardTitle>
      <div className="mt-2 rounded-xl bg-slate-50 p-3 text-[13px]">
        <div className="flex justify-between">
          <span>Estimasi AI</span>
          <span className="font-bold">{formatIdr(estTotal)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Aktual ({withActual} item)</span>
          <span className="font-bold">{hasActual ? formatIdr(actualTotal) : "—"}</span>
        </div>
        {hasActual ? (
          <p className={`mt-1 text-xs font-semibold ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {diff >= 0 ? `Hemat ${formatIdr(diff)} 🎉` : `Overbudget ${formatIdr(Math.abs(diff))}`}
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">Isi nominal aktual per item untuk melihat hemat/overbudget.</p>
        )}
      </div>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {items.slice(0, 30).map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate font-semibold">
                D{item.day_number} · {item.title}
              </p>
              <span className="shrink-0 text-zinc-500">{formatIdr(item.est_cost_idr)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-zinc-500">
                Aktual: {item.actual_cost_idr !== null && item.actual_cost_idr !== undefined ? formatIdr(item.actual_cost_idr) : "—"}
              </span>
              {canEdit ? (
                <>
                  <input
                    value={drafts[item.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                    placeholder="Rp …"
                    inputMode="numeric"
                    className="h-8 w-28 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => save(item.id)}
                    disabled={saving === item.id}
                    className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {saving === item.id ? "…" : "Simpan"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
