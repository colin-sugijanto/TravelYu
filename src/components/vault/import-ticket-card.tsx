"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardTitle } from "@/components/ui/card";
import type { ParsedBooking } from "@/types/domain";

interface ImportTicketCardProps {
  /** When set, parsed ticket is saved into this trip. When omitted, a NEW trip is created. */
  tripId?: string;
  compact?: boolean;
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

/**
 * Seamless ticket import: paste text → AI parse → optional file attach (Supabase Storage)
 * → save to current trip OR auto-create a new trip scaffold ("Buat trip dari tiket").
 * Responsive: stacks on mobile, 2-col on desktop.
 */
export function ImportTicketCard({ tripId, compact = false }: ImportTicketCardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedBooking | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      const payload = (await res.json()) as { parsed?: ParsedBooking; source?: string; error?: string; message?: string };
      if (!res.ok) {
        setMessage(payload.message ?? payload.error ?? "Gagal parse booking.");
        return;
      }
      setParsed(payload.parsed ?? null);
      setSource(payload.source ?? "ai");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!parsed || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      // Path A: save into existing trip (with optional file upload to Supabase Storage)
      if (tripId) {
        if (file) {
          const form = new FormData();
          form.append("file", file);
          form.append("rawText", rawText);
          form.append("title", parsed.title);
          form.append("booking_type", parsed.booking_type);
          if (parsed.provider) form.append("provider", parsed.provider);
          if (parsed.booking_ref) form.append("booking_ref", parsed.booking_ref);
          if (parsed.origin) form.append("origin", parsed.origin);
          if (parsed.destination) form.append("destination", parsed.destination);
          if (parsed.depart_at) form.append("depart_at", parsed.depart_at);
          if (parsed.arrive_at) form.append("arrive_at", parsed.arrive_at);
          if (parsed.check_in) form.append("check_in", parsed.check_in);
          if (parsed.check_out) form.append("check_out", parsed.check_out);
          const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/bookings/upload`, { method: "POST", body: form });
          const payload = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || !payload.ok) {
            setMessage(payload.error ?? "Gagal mengunggah tiket.");
            return;
          }
        } else {
          const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
          });
          const payload = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || !payload.ok) {
            setMessage(payload.error ?? "Gagal menyimpan booking.");
            return;
          }
        }
        setMessage("Tiket tersimpan ✓ AI akan merencanakan hari-harimu di sekitar tiket ini.");
        setParsed(null);
        setRawText("");
        setFile(null);
        router.refresh();
        return;
      }

      // Path B: brand-new trip scaffold from ticket
      let fileUrl: string | undefined;
      if (file) {
        // Upload happens after trip creation via the trip-scoped endpoint; create trip first below,
        // then attach. For simplicity when no trip exists yet, we create trip first without file,
        // then upload file in a second call.
      }
      const res = await fetch("/api/trips/from-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed, fileUrl, rawText: rawText.slice(0, 2000) }),
      });
      const payload = (await res.json()) as { ok?: boolean; trip?: { id: string }; error?: string };
      if (!res.ok || !payload.ok || !payload.trip) {
        setMessage(payload.error ?? "Gagal membuat trip dari tiket.");
        return;
      }
      const newTripId = payload.trip.id;
      if (file) {
        try {
          const form = new FormData();
          form.append("file", file);
          form.append("rawText", rawText);
          form.append("title", parsed.title);
          form.append("booking_type", parsed.booking_type);
          await fetch(`/api/trip/${encodeURIComponent(newTripId)}/bookings/upload`, { method: "POST", body: form });
        } catch {
          // trip already created — file attach is best-effort
        }
      }
      router.push(`/trip/${encodeURIComponent(newTripId)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={compact ? "p-4" : "p-5"}>
      <CardTitle>{tripId ? "🎫 Import Tiket ke Trip Ini" : "🎫 Punya Tiket? Import Sekali Tap"}</CardTitle>
      <p className="mt-1 text-xs text-zinc-500">
        {tripId
          ? "Tempel teks e-ticket atau upload PDF/gambar → tersimpan di Supabase Storage + AI jadikan patokan itinerary."
          : "Tempel teks tiket (Traveloka/Tiket.com/Garuda/Lion/KAI/Agoda) → AI buatkan trip + jadikan tiket sebagai patokan."}
      </p>

      <div className="mt-3 flex gap-1.5 text-xs">
        {(["paste", "upload"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 font-bold transition ${tab === t ? "bg-zinc-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {t === "paste" ? "✨ Paste teks tiket" : "📎 Upload PDF/gambar"}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          {tab === "paste" ? (
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={compact ? 2 : 3}
              placeholder="Contoh: GA-412 CGK → DPS 12 Nov 09:30 PNR ABC123 …"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400 md:text-sm"
            />
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center transition hover:border-amber-300 hover:bg-amber-50/40">
              <span className="text-xl">📄</span>
              <span className="text-xs font-bold text-slate-700">{file ? file.name.slice(0, 40) : "Tap untuk pilih PDF / gambar tiket"}</span>
              <span className="text-[11px] text-zinc-400">Maks 10MB · tersimpan aman di Supabase Storage</span>
              <input
                type="file"
                accept=".pdf,image/*,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setTab("paste");
                    setMessage("File siap dilampirkan. Tempel juga teks tiketnya untuk hasil parse terbaik (opsional tapi disarankan).");
                  }
                }}
              />
            </label>
          )}
          {tab === "paste" && file ? (
            <p className="text-[11px] text-emerald-700">📎 {file.name.slice(0, 50)} akan diunggah ke Supabase Storage saat disimpan.</p>
          ) : null}
          {tab === "paste" && !file ? (
            <button
              type="button"
              onClick={() => setTab("upload")}
              className="text-[11px] font-semibold text-amber-700 underline decoration-dotted"
            >
              + lampirkan file PDF/gambar (opsional)
            </button>
          ) : null}
        </div>
        <div className="flex flex-row gap-2 md:flex-col md:justify-end">
          <button
            type="button"
            onClick={parse}
            disabled={busy !== null || !rawText.trim()}
            className="flex-1 rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 md:flex-none"
          >
            {busy === "parse" ? "Parsing…" : "✨ Parse"}
          </button>
          {parsed ? (
            <button
              type="button"
              onClick={save}
              disabled={busy !== null}
              className="flex-1 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 md:flex-none"
            >
              {busy === "save" ? "Menyimpan…" : tripId ? "Simpan tiket" : "Buat trip →"}
            </button>
          ) : null}
        </div>
      </div>

      {parsed ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <p className="font-bold">{TYPE_LABEL[parsed.booking_type] ?? parsed.booking_type} · {parsed.title}</p>
          <p className="mt-0.5">
            {parsed.provider ?? "—"} · PNR {parsed.booking_ref ?? "—"} · {parsed.origin ?? "?"} → {parsed.destination ?? "?"} ({source})
          </p>
          {!tripId ? (
            <p className="mt-1 text-[11px]">Trip baru akan dibuat dengan tujuan & tanggal dari tiket ini. AI intake tinggal melengkapi vibe, budget & peserta.</p>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-2 text-xs text-zinc-600">{message}</p> : null}
    </Card>
  );
}
