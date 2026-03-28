"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface TripCompleteButtonProps {
  tripId: string;
}

export function TripCompleteButton({ tripId }: TripCompleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const complete = async () => {
    if (loading) return;
    const confirmed = window.confirm("Tandai trip ini sebagai selesai? Owner akan mendapat 100 poin.");
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/trips/${encodeURIComponent(tripId)}/complete`, {
        method: "POST",
      });
      if (!response.ok) return;
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={complete}
      disabled={loading}
      className="inline-flex rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Memproses..." : "Tandai Selesai"}
    </button>
  );
}
