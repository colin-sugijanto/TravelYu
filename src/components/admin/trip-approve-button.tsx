"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface TripApproveButtonProps {
  tripId: string;
}

export function TripApproveButton({ tripId }: TripApproveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const approve = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/trips/${encodeURIComponent(tripId)}/approve`, {
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
      onClick={approve}
      disabled={loading}
      className="inline-flex rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Menyetujui..." : "Approve Trip"}
    </button>
  );
}
