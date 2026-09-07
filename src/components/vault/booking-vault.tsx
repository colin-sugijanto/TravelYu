"use client";

import { useEffect, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import type { ItineraryItem, TripBooking } from "@/types/domain";
import { ImportTicketCard } from "./import-ticket-card";

interface BookingVaultProps {
  tripId: string;
  items: ItineraryItem[];
  canEdit?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  flight: "✈️ Flight",
  train: "🚆 Kereta",
  hotel: "🏨 Hotel",
  ferry: "⛴️ Ferry",
  bus: "🚌 Bus",
  activity: "🎟️ Aktivitas",
  other: "📄 Lainnya",
};

function formatWhen(b: TripBooking) {
  const raw = b.depart_at ?? b.check_in ?? b.arrive_at ?? null;
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: b.depart_at ? "2-digit" : undefined, minute: b.depart_at ? "2-digit" : undefined }).format(d);
  } catch {
    return null;
  }
}

/**
 * Ticket Locker v2 — seamless vault:
 * - input via ImportTicketCard (paste + PDF/image upload → Supabase Storage `trip-tickets`)
 * - list with 🔒 anchor badge when linked to itinerary (AI plans around these)
 * - file attachment opens the stored e-ticket, PNR 1-tap copy
 * Responsive grid: 1 col mobile, 2 col desktop.
 */
export function BookingVault({ tripId, items, canEdit = true }: BookingVaultProps) {
  const [bookings, setBookings] = useState<TripBooking[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/bookings`);
      if (!res.ok) return;
      const payload = (await res.json()) as { bookings?: TripBooking[] };
      setBookings(payload.bookings ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const remove = async (bookingId: string) => {
    const res = await fetch(
      `/api/trip/${encodeURIComponent(tripId)}/bookings?bookingId=${encodeURIComponent(bookingId)}`,
      { method: "DELETE" },
    );
    if (res.ok) await load();
  };

  const copy = async (value: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`Disalin: ${value}`);
    } catch {
      setMessage(value);
    }
  };

  const itemById = new Map(items.map((i) => [i.id, i]));
  const anchored = bookings.filter((b) => b.linked_item_id).length;

  return (
    <div className="space-y-3">
      {canEdit ? <ImportTicketCard tripId={tripId} /> : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>🎫 Ticket Locker {bookings.length > 0 ? `· ${bookings.length}` : ""}</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              {anchored > 0
                ? `🔒 ${anchored} tiket jadi patokan AI — itinerary disusun di sekitar tiket ini, bukan sebaliknya.`
                : "Tiket tersimpan jadi patokan AI saat generate / regen itinerary."}
            </p>
          </div>
        </div>

        {message ? <p className="mt-2 text-xs text-zinc-600">{message}</p> : null}

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {bookings.length === 0 ? (
            <p className="text-xs text-zinc-400 md:col-span-2">Belum ada tiket tersimpan untuk trip ini.</p>
          ) : null}
          {bookings.map((b) => {
            const linked = b.linked_item_id ? itemById.get(b.linked_item_id) : null;
            const when = formatWhen(b);
            return (
              <div key={b.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
                      <span>{TYPE_LABEL[b.booking_type] ?? b.booking_type}</span>
                      <span className="truncate">{b.title}</span>
                      {linked ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">🔒 ANCHOR D{linked.day_number}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {b.provider ?? "—"}
                      {b.booking_ref ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => copy(b.booking_ref)}
                            className="font-mono font-bold text-zinc-800 underline decoration-dotted"
                            title="Tap untuk salin PNR"
                          >
                            {b.booking_ref}
                          </button>
                        </>
                      ) : null}
                      {b.origin || b.destination ? ` · ${b.origin ?? "?"} → ${b.destination ?? "?"}` : ""}
                      {when ? ` · ${when}` : ""}
                    </p>
                    {linked ? (
                      <p className="mt-0.5 truncate text-[11px] text-amber-700">↳ {linked.title}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {b.file_url ? (
                        <a
                          href={b.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          📎 Lihat e-ticket
                        </a>
                      ) : null}
                      {b.booking_ref ? (
                        <button
                          type="button"
                          onClick={() => copy(b.booking_ref)}
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                        >
                          Salin PNR
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => remove(b.id)}
                      className="shrink-0 text-[11px] font-semibold text-red-500"
                    >
                      Hapus
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
