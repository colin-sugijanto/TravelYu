"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import type { ItineraryItem, TripPhoto } from "@/types/domain";

interface MemoryScrapbookProps {
  tripId: string;
  items: ItineraryItem[];
  photos: Array<TripPhoto & { public_url?: string; url?: string }>;
  canEdit?: boolean;
}

/**
 * Travel Scrapbook — magazine timeline grouping itinerary items with linked photos.
 * Photos without linkage fall back to day_number, then "Unsorted".
 */
export function MemoryScrapbook({ tripId, items, photos, canEdit = true }: MemoryScrapbookProps) {
  const [linking, setLinking] = useState<string | null>(null);
  const [filterDay, setFilterDay] = useState<number | "all">("all");

  const days = useMemo(() => {
    const set = new Set<number>();
    for (const i of items) set.add(i.day_number);
    for (const p of photos) if (p.day_number) set.add(p.day_number);
    return [...set].sort((a, b) => a - b);
  }, [items, photos]);

  const visibleDays = filterDay === "all" ? days : days.filter((d) => d === filterDay);

  const photosForItem = (itemId: string) => photos.filter((p) => p.itinerary_item_id === itemId);
  const photosForDay = (day: number) =>
    photos.filter((p) => !p.itinerary_item_id && (p.day_number === day || (!p.day_number && filterDay === day)));

  const linkPhoto = async (photoId: string, itemId: string, day: number | null) => {
    setLinking(photoId);
    try {
      await fetch(`/api/trip/${encodeURIComponent(tripId)}/photos/${encodeURIComponent(photoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itinerary_item_id: itemId || null, day_number: day }),
      });
      window.location.reload();
    } finally {
      setLinking(null);
    }
  };

  if (items.length === 0 && photos.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>📖 Travel Scrapbook</CardTitle>
          <p className="mt-1 text-xs text-zinc-500">Rute, tiket, dan fotomu berdampingan per hari.</p>
        </div>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterDay("all")}
            className={`rounded-full px-2.5 py-1 font-semibold ${filterDay === "all" ? "bg-zinc-900 text-white" : "bg-slate-100"}`}
          >
            Semua
          </button>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFilterDay(d)}
              className={`rounded-full px-2.5 py-1 font-semibold ${filterDay === d ? "bg-zinc-900 text-white" : "bg-slate-100"}`}
            >
              D{d}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {visibleDays.map((day) => {
          const dayItems = items.filter((i) => i.day_number === day).sort((a, b) => a.sort_order - b.sort_order);
          const loose = photosForDay(day);
          return (
            <div key={day} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-extrabold">Day {day}</p>
              <div className="mt-2 space-y-2">
                {dayItems.map((item) => {
                  const linked = photosForItem(item.id);
                  return (
                    <div key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[13px] font-bold">{item.title}</p>
                      <p className="text-[11px] text-zinc-500">
                        {item.time_slot} · {item.activity_type}
                      </p>
                      {linked.length > 0 ? (
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {linked.map((p) => {
                            const url = p.public_url ?? p.url;
                            if (!url) return null;
                            return (
                              <div key={p.id} className="relative h-20 overflow-hidden rounded-lg">
                                <Image src={url} alt={p.caption ?? ""} fill className="object-cover" sizes="120px" />
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {loose.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {loose.map((p) => {
                      const url = p.public_url ?? p.url;
                      if (!url) return null;
                      return (
                        <div key={p.id} className="overflow-hidden rounded-lg border border-slate-200">
                          <div className="relative h-20">
                            <Image src={url} alt={p.caption ?? ""} fill className="object-cover" sizes="120px" />
                          </div>
                          {canEdit ? (
                            <select
                              disabled={linking === p.id}
                              defaultValue=""
                              onChange={(e) => {
                                const [itemId] = e.target.value.split("|");
                                if (itemId) void linkPhoto(p.id, itemId, day);
                              }}
                              className="w-full bg-white px-1 py-1 text-[10px]"
                            >
                              <option value="">Pin ke momen…</option>
                              {dayItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title.slice(0, 30)}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {dayItems.length === 0 && loose.length === 0 ? (
                  <p className="text-xs text-zinc-400">Belum ada momen hari ini.</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
