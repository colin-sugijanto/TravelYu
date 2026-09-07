"use client";

import { useMemo, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";
import type { ItineraryItem, TripBooking } from "@/types/domain";

interface TodayModeProps {
  tripId: string;
  items: ItineraryItem[];
  bookings: TripBooking[];
  tripStartDate: string | null;
}

/** Days are 1-indexed from trip_start_date; clamps into the itinerary range. */
function currentDayNumber(tripStartDate: string | null, maxDay: number): number {
  if (!tripStartDate) return 1;
  const start = new Date(`${tripStartDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 1;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.min(Math.max(diffDays, 1), Math.max(maxDay, 1));
}

export function TodayMode({ tripId, items, bookings, tripStartDate }: TodayModeProps) {
  const maxDay = useMemo(() => items.reduce((m, i) => Math.max(m, i.day_number), 1), [items]);
  const today = currentDayNumber(tripStartDate, maxDay);
  const todaysItems = useMemo(
    () => items.filter((i) => i.day_number === today).sort((a, b) => a.sort_order - b.sort_order),
    [items, today],
  );
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  const quickSnap = async () => {
    if (!note.trim() || todaysItems.length === 0) return;
    const target = todaysItems[0];
    if (!target) return;
    try {
      await fetch(`/api/trip/${encodeURIComponent(tripId)}/photos-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: note.trim(), day_number: today, itinerary_item_id: target.id }),
      });
    } catch {
      // endpoint optional — treat as local-only note
    }
    setSaved(true);
    setNote("");
    window.setTimeout(() => setSaved(false), 2500);
  };

  if (items.length === 0) return null;

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>🧭 Today Mode · Day {today}</CardTitle>
        <span className="rounded-full bg-teal-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          Live
        </span>
      </div>
      <p className="mt-1 text-xs text-teal-800">
        {todaysItems.length} aktivitas hari ini
        {tripStartDate ? ` · mulai ${tripStartDate}` : ""}. Tap PNR/alamat untuk salin ke Grab/Gojek.
      </p>

      <div className="mt-3 space-y-2">
        {todaysItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-teal-100 bg-white px-3 py-2">
            <p className="text-[13px] font-bold">{item.title}</p>
            <p className="text-[11px] text-zinc-500">
              {item.time_slot} · {item.activity_type} · {formatIdr(item.est_cost_idr)}
            </p>
            {item.location_address ? (
              <button
                type="button"
                onClick={() => copy(item.location_address ?? "")}
                className="mt-1 text-left text-[11px] text-teal-700 underline decoration-dotted"
                title="Salin alamat"
              >
                📍 {item.location_address}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {bookings.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {bookings.slice(0, 4).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => copy(b.booking_ref ?? b.title)}
              className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-800"
              title="Salin PNR"
            >
              🎫 {b.booking_ref ?? b.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quick snap: 1 kalimat momen hari ini…"
          className="h-10 flex-1 rounded-full border border-teal-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
        />
        <button
          type="button"
          onClick={quickSnap}
          className="rounded-full bg-teal-600 px-4 text-xs font-bold text-white"
        >
          {saved ? "✓ Tersimpan" : "Snap"}
        </button>
      </div>
    </Card>
  );
}
