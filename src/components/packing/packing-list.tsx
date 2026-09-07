"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface PackingItem {
  item: string;
  category: string;
  checked: boolean;
}

export function PackingList({ initialItems, storageKey }: { initialItems: PackingItem[]; storageKey?: string }) {
  const [items, setItems] = useState<PackingItem[]>(() => {
    if (!storageKey || typeof window === "undefined") return initialItems;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return initialItems;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      return initialItems.map((row) => ({ ...row, checked: saved[row.item] ?? row.checked }));
    } catch {
      return initialItems;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      const map: Record<string, boolean> = {};
      for (const row of items) map[row.item] = row.checked;
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
      // storage unavailable
    }
  }, [items, storageKey]);

  const packed = useMemo(() => items.filter((i) => i.checked).length, [items]);
  const progress = items.length > 0 ? Math.round((packed / items.length) * 100) : 0;
  const byCategory = useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const row of items) {
      const key = row.category?.trim() || "Lainnya";
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(row);
    }
    return [...map.entries()];
  }, [items]);

  const toggleAll = (checked: boolean) => {
    setItems((prev) => prev.map((row) => ({ ...row, checked })));
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>🎒 Packing List</CardTitle>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {packed}/{items.length} terbungkus
        </span>
      </div>
      <Progress className="mt-3" value={progress} />
      <div className="mt-2 flex gap-2 text-xs">
        <button type="button" onClick={() => toggleAll(true)} className="font-semibold text-emerald-700 hover:underline">
          Tandai semua
        </button>
        <span className="text-slate-300">·</span>
        <button type="button" onClick={() => toggleAll(false)} className="font-semibold text-slate-500 hover:underline">
          Reset
        </button>
      </div>
      <div className="mt-3 space-y-4">
        {byCategory.map(([category, rows]) => (
          <div key={category}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{category}</p>
            <div className="space-y-2">
              {rows.map((entry) => {
                const idx = items.indexOf(entry);
                return (
                <label key={`${entry.item}-${idx}`} className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${entry.checked ? "bg-emerald-50 text-emerald-900 line-through opacity-80" : "bg-[var(--bg-alt)]"}`}>
                  <span>{entry.item}</span>
                  <input
                    type="checkbox"
                    checked={entry.checked}
                    onChange={(event) => {
                      setItems((prev) =>
                        prev.map((row, rowIdx) => {
                          if (rowIdx !== idx) return row;
                          return { ...row, checked: event.target.checked };
                        }),
                      );
                    }}
                    className="h-4 w-4 accent-emerald-600"
                  />
                </label>
                );
              })}
            </div>
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-[var(--text-soft)]">Packing list kosong.</p> : null}
      </div>
      <p className="mt-3 text-[11px] text-zinc-400">Centang tersimpan otomatis di perangkat ini.</p>
    </Card>
  );
}
