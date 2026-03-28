"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Play } from "lucide-react";

interface TripActionBannerProps {
  tripId: string;
  tripStatus: "approved" | "active";
}

/**
 * TripActionBanner — shown on the trip detail workspace for approved and active trips.
 * Allows the trip owner to:
 *  - Mark an approved trip as "active" (trip has started)
 *  - Mark an active trip as "completed" (trip has ended — awards 100 pts)
 */
export function TripActionBanner({ tripId, tripStatus }: TripActionBannerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleActivate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/activate`, {
        method: "PATCH",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (loading) return;
    const confirmed = window.confirm(
      "Tandai trip ini sebagai selesai? Kamu akan mendapat 100 poin dan bisa menulis ulasan vendor.",
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  if (tripStatus === "approved") {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
          <Play className="w-4 h-4 text-orange-600 fill-orange-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-orange-800 text-sm">Itinerary sudah siap!</p>
          <p className="text-orange-700 text-xs mt-0.5">
            Sudah waktunya berangkat? Aktifkan trip untuk akses mode perjalanan aktif.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleActivate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Mengaktifkan..." : "🚀 Mulai Trip"}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-orange-400 hover:text-orange-600 text-xs transition-colors"
            aria-label="Tutup banner"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // active status
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
        <CheckCircle className="w-4 h-4 text-teal-600" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-teal-800 text-sm">Perjalanan aktif</p>
        <p className="text-teal-700 text-xs mt-0.5">
          Trip sudah selesai? Tandai selesai untuk mendapatkan 100 poin dan membuka fitur ulasan.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleComplete}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Memproses..." : "✅ Selesai"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-teal-400 hover:text-teal-600 text-xs transition-colors"
          aria-label="Tutup banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
