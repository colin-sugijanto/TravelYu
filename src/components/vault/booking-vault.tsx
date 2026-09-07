"use client";

import { useEffect, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import type { ItineraryItem, ParsedBooking, TripBooking } from "@/types/domain";

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

export function BookingVault({ tripId, items, canEdit = true }: BookingVaultProps) {
  const [bookings, setBookings] = useState<TripBooking[]>([]);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedBooking | null>(null);
  const [parseSource, setParseSource] = useState<string | null>(null);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkedItemId, setLinkedItemId] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/bookings`);
      if (!res.ok) return;
      const payload = (await res.json()) as { bookings?: TripBooking[] };
      setBookings(payload.bookings ?? []);
    } catch {
      // ignore — vault stays empty until migration applied
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const parse = async () => {
    if (!rawText.trim() || busy) return;
    setBusy("parse");
    setMessage(null);
    try {
      const res = await fetch("/api/ai/parse-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText, tripId }),
      });
      const payload = (await res.json()) as {
        parsed?: ParsedBooking;
        source?: string;
        error?: string;
        message?: string;
        code?: string;
      };
      if (!res.ok) {
        setMessage(payload.message ?? payload.error ?? "Gagal parse booking.");
        return;
      }
      setParsed(payload.parsed ?? null);
      setParseSource(payload.source ?? "ai");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!parsed || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, linked_item_id: linkedItemId || null }),
      });
      const payload = (await res.json()) as { ok?: boolean; booking?: TripBooking; error?: string };
      if (!res.ok || !payload.ok) {
        setMessage(payload.error ?? "Gagal menyimpan booking.");
        return;
      }
      setParsed(null);
      setRawText("");
      setLinkedItemId("");
      setMessage("Booking tersimpan di Ticket Locker ✓");
      await load();
    } finally {
      setBusy(null);
    }
  };

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

  return (
    <Card className="p-5">
      <CardTitle>🎫 Ticket Locker</CardTitle>
      <p className="mt-1 text-xs text-zinc-500">
        Tempel teks tiket (Traveloka/Tiket.com/Garuda/Lion/KAI/Agoda) → AI ekstrak PNR, jam & hotel →
        tersimpan di itinerary. Biaya 3 kredit AI per parse.
      </p>

      {canEdit ? (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={3}
            placeholder="Contoh: GA-412 CGK → DPS 12 Nov 09:30 PNR ABC123 …"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={parse}
              disabled={busy !== null || !rawText.trim()}
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy === "parse" ? "Parsing…" : "✨ Parse dengan AI"}
            </button>
            {parsed ? (
              <select
                value={linkedItemId}
                onChange={(e) => setLinkedItemId(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">Tanpa link item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    Day {item.day_number} · {item.title.slice(0, 40)}
                  </option>
                ))}
              </select>
            ) : null}
            {parsed ? (
              <button
                type="button"
                onClick={save}
                disabled={busy !== null}
                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy === "save" ? "Menyimpan…" : "Simpan ke Locker"}
              </button>
            ) : null}
          </div>

          {parsed ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <p className="font-bold">
                {TYPE_LABEL[parsed.booking_type] ?? parsed.booking_type} · {parsed.title}
              </p>
              <p className="mt-0.5">
                {parsed.provider ?? "—"} · PNR: {parsed.booking_ref ?? "—"} ·{" "}
                {parsed.origin ?? "?"} → {parsed.destination ?? "?"} ({parseSource})
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-2 text-xs text-zinc-600">{message}</p> : null}

      <div className="mt-3 space-y-2">
        {bookings.length === 0 ? (
          <p className="text-xs text-zinc-400">Belum ada tiket tersimpan untuk trip ini.</p>
        ) : null}
        {bookings.map((b) => (
          <div key={b.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold">
                  {TYPE_LABEL[b.booking_type] ?? b.booking_type} · {b.title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {b.provider ?? "—"}
                  {b.booking_ref ? (
                    <>
                      {" · PNR "}
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
                </p>
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
        ))}
      </div>
    </Card>
  );
}
