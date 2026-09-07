"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";
import type { ItineraryItem, TodayNote, TripBooking, TripPhoto } from "@/types/domain";

interface StoryTimelineProps {
  tripId: string;
  items: ItineraryItem[];
  bookings: TripBooking[];
  photos: Array<TripPhoto & { public_url?: string; url?: string }>;
  notes: TodayNote[];
  canEdit?: boolean;
}

type PhotoLike = TripPhoto & { public_url?: string; url?: string };

function photoUrl(p: PhotoLike): string | null {
  return p.public_url ?? p.url ?? null;
}

/**
 * Memory Timeline 2.0 — "Storybook": per-day magazine view merging
 * itinerary + linked photos + journal notes + ticket anchors + actual spend.
 * Mobile: vertical scroll. Desktop: 2-col magazine grid.
 */
export function StoryTimeline({ items, bookings, photos, notes }: StoryTimelineProps) {
  const [filterDay, setFilterDay] = useState<number | "all">("all");

  const days = useMemo(() => {
    const set = new Set<number>();
    for (const i of items) set.add(i.day_number);
    for (const p of photos) if (p.day_number) set.add(p.day_number);
    for (const n of notes) if (n.day) set.add(n.day);
    return [...set].sort((a, b) => a - b);
  }, [items, photos, notes]);

  const visibleDays = filterDay === "all" ? days : days.filter((d) => d === filterDay);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const linkedDayByBooking = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.linked_item_id) {
        const it = itemById.get(b.linked_item_id);
        if (it) map.set(b.id, it.day_number);
      }
    }
    return map;
  }, [bookings, itemById]);

  if (days.length === 0) return null;

  const unlinkedBookings = bookings.filter((b) => !linkedDayByBooking.has(b.id));

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>📖 Storybook Perjalanan</CardTitle>
          <p className="mt-1 text-xs text-zinc-500">Rute, tiket asli, foto & catatan harian — tersusun otomatis per hari.</p>
        </div>
        <div className="flex max-w-full flex-wrap gap-1 text-xs">
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

      {unlinkedBookings.length > 0 && filterDay === "all" ? (
        <div className="mt-3 flex flex-wrap gap-1.5 rounded-xl bg-amber-50 p-2.5 ring-1 ring-amber-100">
          {unlinkedBookings.slice(0, 6).map((b) => (
            <span key={b.id} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
              🎫 {b.title.slice(0, 32)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {visibleDays.map((day) => {
          const dayItems = items.filter((i) => i.day_number === day).sort((a, b) => a.sort_order - b.sort_order);
          const dayPhotos = photos.filter((p) => p.day_number === day || (!p.day_number && !p.itinerary_item_id));
          const dayNotes = notes.filter((n) => n.day === day);
          const dayBookings = bookings.filter((b) => linkedDayByBooking.get(b.id) === day);
          const dayEst = dayItems.reduce((s, i) => s + (i.est_cost_idr ?? 0), 0);
          const dayActualRows = dayItems.filter((i) => i.actual_cost_idr !== null && i.actual_cost_idr !== undefined);
          const dayActual = dayActualRows.reduce((s, i) => s + (i.actual_cost_idr ?? 0), 0);

          return (
            <article key={day} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between bg-gradient-to-r from-zinc-900 to-zinc-700 px-4 py-2.5 text-white">
                <p className="text-sm font-extrabold">Day {day}</p>
                <p className="text-[11px] opacity-80">
                  {dayItems.length} momen · {dayPhotos.length} foto{dayActualRows.length > 0 ? ` · ${formatIdr(dayActual)}` : ` · ${formatIdr(dayEst)} est`}
                </p>
              </div>

              <div className="space-y-3 p-3">
                {dayBookings.length > 0 ? (
                  <div className="space-y-1.5">
                    {dayBookings.map((b) => (
                      <div key={b.id} className="rounded-xl bg-amber-50 px-3 py-2 text-xs ring-1 ring-amber-200">
                        <p className="font-bold text-amber-900">🔒 {b.title}</p>
                        <p className="text-[11px] text-amber-700">
                          {b.provider ?? ""} {b.booking_ref ? `· ${b.booking_ref}` : ""} {b.origin || b.destination ? `· ${b.origin ?? "?"} → ${b.destination ?? "?"}` : ""}
                          {b.file_url ? (
                            <>
                              {" · "}
                              <a href={b.file_url} target="_blank" rel="noopener noreferrer" className="underline">e-ticket</a>
                            </>
                          ) : null}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {dayItems.length === 0 ? <p className="text-xs text-zinc-400">Belum ada itinerary hari ini.</p> : null}
                {dayItems.map((item) => {
                  const linked = photos.filter((p) => p.itinerary_item_id === item.id);
                  return (
                    <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[13px] font-bold">{item.title}</p>
                      <p className="text-[11px] text-zinc-500">{item.time_slot} · {item.activity_type} · {formatIdr(item.est_cost_idr)}</p>
                      {linked.length > 0 ? (
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {linked.map((p) => {
                            const url = photoUrl(p);
                            if (!url) return null;
                            return (
                              <div key={p.id} className="relative h-20 overflow-hidden rounded-lg md:h-24">
                                <Image src={url} alt={p.caption ?? item.title} fill className="object-cover" sizes="(max-width:768px) 30vw, 200px" />
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {dayPhotos.filter((p) => !p.itinerary_item_id).slice(0, 6).length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {dayPhotos.filter((p) => !p.itinerary_item_id).slice(0, 6).map((p) => {
                      const url = photoUrl(p);
                      if (!url) return null;
                      return (
                        <div key={p.id} className="relative h-20 overflow-hidden rounded-lg md:h-24">
                          <Image src={url} alt={p.caption ?? ""} fill className="object-cover" sizes="(max-width:768px) 30vw, 200px" />
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {dayNotes.length > 0 ? (
                  <div className="space-y-1.5 border-l-2 border-teal-200 pl-2.5">
                    {dayNotes.slice(-3).map((n, idx) => (
                      <p key={`${n.ts}-${idx}`} className="text-xs italic text-slate-600">“{n.text}”</p>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
