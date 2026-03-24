"use client";

import { useCallback, useEffect, useState } from "react";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";

interface QrisPaymentProps {
  tripId: string;
  amount: number;
}

export function QRISPayment({ tripId, amount }: QrisPaymentProps) {
  const [seconds, setSeconds] = useState(15 * 60);
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<"pending" | "paid" | "failed">("pending");
  const [orderId, setOrderId] = useState<string | null>(null);

  const requestQris = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/payment/create-qris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          amount,
          customerName: "TravelYu User",
          customerEmail: "user@example.com",
        }),
      });
      const payload = await response.json();
      if (response.ok) {
        setOrderId(payload.orderId ?? null);
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("failed");
    } finally {
      setIsCreating(false);
    }
  }, [amount, tripId]);

  useEffect(() => {
    void requestQris();
  }, [requestQris]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderId) return;

    const poll = setInterval(async () => {
      const result = await fetch(`/api/payment/midtrans-webhook-status?orderId=${encodeURIComponent(orderId)}`);
      if (!result.ok) return;
      const payload = await result.json();
      if (payload.paymentStatus === "paid") {
        setStatus("paid");
        clearInterval(poll);
      }
    }, 6000);

    return () => clearInterval(poll);
  }, [orderId]);

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");

  return (
    <Card className="p-5">
      <CardTitle>QRIS Payment Wall</CardTitle>
      <CardText className="mt-1">Trip: {tripId}</CardText>
      <p className="mt-2 text-2xl font-black">{formatIdr(amount)}</p>

      <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-white p-6 text-center">
        <div className="mx-auto h-40 w-40 rounded-lg border border-[var(--border)] bg-[repeating-linear-gradient(45deg,#e5ece2,#e5ece2_8px,#f7faf5_8px,#f7faf5_16px)]" />
        <p className="mt-3 text-xs text-[var(--text-soft)]">{orderId ? `Order ID: ${orderId}` : "Generating payment..."}</p>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--bg-alt)] px-3 py-2 text-sm">
        <span>Expires in</span>
        <span className="font-semibold">
          {minutes}:{remainder}
        </span>
      </div>

      <div className="mt-3 rounded-lg bg-[var(--bg-alt)] px-3 py-2 text-xs text-[var(--text-soft)]">
        Payment status: <span className="font-semibold uppercase">{status}</span>
      </div>

      <button
        className="mt-3 h-10 w-full rounded-full border border-[var(--border)] bg-white text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--bg-alt)]"
        onClick={requestQris}
        disabled={isCreating}
      >
        {isCreating ? "Generating..." : "Regenerate QRIS"}
      </button>
    </Card>
  );
}
