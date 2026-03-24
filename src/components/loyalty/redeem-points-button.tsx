"use client";

import { useState } from "react";

interface RedeemPointsButtonProps {
  points: number;
}

export function RedeemPointsButton({ points }: RedeemPointsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canRedeem = points >= 500;

  const redeem = async () => {
    if (!canRedeem || isLoading) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/rewards/redeem", {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Gagal redeem poin");
        return;
      }

      setMessage(`Redeem berhasil: ${payload.redeemedPoints} poin`);
    } catch {
      setMessage("Gagal redeem poin");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={redeem}
        disabled={!canRedeem || isLoading}
        className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Redeeming..." : "Redeem Planning Discount"}
      </button>
      <p className="text-xs text-[var(--text-soft)]">{canRedeem ? "500 poin untuk diskon, 1000 poin untuk free planning fee" : "Minimal 500 poin untuk redeem"}</p>
      {message ? <p className="text-xs text-[var(--text-soft)]">{message}</p> : null}
    </div>
  );
}
