"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

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
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectOption = async (optionNumber: number) => {
    if (isSaving) return;

    setIsSaving(true);
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
      setIsSaving(false);
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
        setErrorMessage("Gagal memproses generation.");
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
    <div className="space-y-4">
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
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving && selectedOption === option.option_number ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : selectedOption === option.option_number ? (
                "Opsi Terpilih"
              ) : (
                "Pilih Opsi Ini"
              )}
            </button>
          </Card>
        ))}

        {options.length === 0 ? (
          <Card className="p-5 lg:col-span-3">
            <CardTitle>Belum ada opsi comparison</CardTitle>
            <CardText className="mt-2">Selesaikan intake lalu klik generate comparison options.</CardText>
          </Card>
        ) : null}
      </div>

      <Card className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-[var(--border)]">
        <CardTitle>Lanjutkan ke Itinerary</CardTitle>
        <CardText className="mt-2">Development mode aktif. Payment di-bypass dan itinerary bisa langsung digenerate.</CardText>

        {errorMessage ? <p className="mt-2 text-xs text-[var(--danger)]">{errorMessage}</p> : null}

        <button
          type="button"
          onClick={generateTrip}
          disabled={isGenerating || isSaving || selectedOption === null}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {isGenerating ? "Generating..." : "Generate Itinerary"}
        </button>
      </Card>
    </div>
  );
}
