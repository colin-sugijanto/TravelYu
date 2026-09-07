"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isRealtimeConfigured } from "@/lib/realtime";

/**
 * Polls router.refresh() while the trip is in "generating" status.
 * If Realtime is configured, uses a relaxed 15s heartbeat fallback.
 * If Realtime is not configured, polls every 4s.
 */
export function GeneratingPoller() {
  const router = useRouter();

  useEffect(() => {
    const intervalMs = isRealtimeConfigured ? 15000 : 4000;
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [router]);

  return null;
}
