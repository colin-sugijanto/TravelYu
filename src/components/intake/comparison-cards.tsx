"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";
import type { ComparisonOption } from "@/types/domain";

interface ComparisonCardsProps {
  tripId: string;
  options: ComparisonOption[];
}

export function ComparisonCards({ tripId, options }: ComparisonCardsProps) {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<number | null>(options.find((option) => option.is_selected)?.option_number ?? null);
  const [pendingOption, setPendingOption] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSaving = pendingOption !== null;

  const selectOption = async (optionNumber: number) => {
    if (isSaving) return;

    setPendingOption(optionNumber);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/select-option`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionNumber }),
      });

      if (response.ok) {
        setSelectedOption(optionNumber);
        return;
      }

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "Gagal menyimpan opsi terpilih.");
    } finally {
      setPendingOption(null);
    }
  };

  const generateTrip = async () => {
    if (isGenerating || selectedOption === null) return;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // First, mark the option as selected so the server knows which one to use
      const selectResp = await fetch(`/api/trip/${encodeURIComponent(tripId)}/select-option`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionNumber: selectedOption }),
      });
      if (!selectResp.ok) {
        const payload = (await selectResp.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(payload?.error ?? "Gagal menyimpan opsi terpilih.");
        return;
      }

      // The endpoint immediately returns 202 Accepted after setting the DB state to "generating"
      // while the actual AI generation runs in the background. We await it here so we don't
      // redirect before the DB state is updated.
      const generateResp = await fetch(`/api/trip/${encodeURIComponent(tripId)}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedOption }),
      });

      if (!generateResp.ok) {
        const payload = (await generateResp.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(payload?.error ?? "Gagal memproses generation.");
        setIsGenerating(false);
        return;
      }

      // Redirect immediately; the trip page shows a "Sedang Diproses" banner + auto-polls
      router.push(`/trip/${encodeURIComponent(tripId)}`);
    } catch {
      setErrorMessage("Gagal generate itinerary.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/trip/new/intake?tripId=${encodeURIComponent(tripId)}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke intake
        </Link>
        <ol className="flex items-center gap-1.5 text-[11px] font-bold" aria-label="Langkah pembuatan trip">
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">1 · Mode</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">2 · Intake</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-zinc-900 px-2.5 py-1 text-white">3 · Opsi</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">4 · Itinerary</li>
        </ol>
      </div>

      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Pilih gaya trip favoritmu</h1>
        <p className="mt-1 text-sm text-[var(--text-soft)]">Bandingkan 3 opsi AI, pilih satu, lalu generate itinerary lengkap (±25 kredit AI, ±5 menit).</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {options.map((option) => (
          <Card key={option.id} className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-[var(--border)]">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{option.summary.title}</CardTitle>
              <Badge tone={selectedOption === option.option_number ? "brand" : "neutral"}>{selectedOption === option.option_number ? "Selected" : `Option ${option.option_number}`}</Badge>
            </div>

            <CardText className="mt-2">{option.summary.rationale}</CardText>

            <div className="mt-3 flex flex-wrap gap-1">
              {option.summary.vibeTags.map((tag) => (
                <Badge key={tag} tone="sun">
                  {tag}
                </Badge>
              ))}
            </div>

            <p className="mt-3 text-sm font-semibold text-[var(--text)]">{formatIdr(option.summary.estimatedBudgetIdr)}</p>

            <ul className="mt-2 list-disc pl-5 text-xs text-[var(--text-soft)]">
              {option.summary.destinationHighlights.map((place) => (
                <li key={place}>{place}</li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => selectOption(option.option_number)}
              disabled={isSaving}
              aria-pressed={selectedOption === option.option_number}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingOption === option.option_number ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : selectedOption === option.option_number ? (
                "✓ Opsi Terpilih"
              ) : (
                "Pilih Opsi Ini"
              )}
            </button>
          </Card>
        ))}

        {options.length === 0 ? (
          <Card className="p-6 text-center lg:col-span-3">
            <CardTitle>Belum ada opsi comparison</CardTitle>
            <CardText className="mt-2">Intake belum menghasilkan opsi. Kembali ke intake untuk melengkapi jawaban, lalu coba lagi.</CardText>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href={`/trip/new/intake?tripId=${encodeURIComponent(tripId)}`}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Lengkapi intake
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Ke dashboard
              </Link>
            </div>
          </Card>
        ) : null}
      </div>

      <Card className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-[var(--border)]">
        <CardTitle>Buat itinerary lengkap</CardTitle>
        <CardText className="mt-2">Setelah pilih opsi, AI akan menyusun jadwal harian + estimasi budget. Proses ±5 menit — halaman trip akan update otomatis.</CardText>

        {errorMessage ? <p className="mt-2 text-xs text-[var(--danger)]">{errorMessage}</p> : null}

        <button
          type="button"
          onClick={generateTrip}
          disabled={isGenerating || isSaving || selectedOption === null}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {isGenerating ? "Membuat itinerary…" : selectedOption === null ? "Pilih salah satu opsi dulu" : "Buat Itinerary dari Opsi Terpilih"}
        </button>
      </Card>
    </div>
  );
}
