"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TripStatus } from "@/types/domain";
import { supabaseRealtime } from "@/lib/realtime";

interface TripStatusWatcherProps {
  tripId: string;
  initialStatus: TripStatus;
}

/**
 * TripStatusWatcher — subscribes to Supabase Realtime for changes on the trips
 * table and calls router.refresh() when the status leaves 'generating'.
 * Replaces the polling-based GeneratingPoller for a lower-latency experience.
 */
export function TripStatusWatcher({ tripId, initialStatus }: TripStatusWatcherProps) {
  const router = useRouter();

  useEffect(() => {
    if (initialStatus !== "generating") return;

    const channel = supabaseRealtime
      .channel(`trip-status-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: TripStatus })?.status;
          if (newStatus && newStatus !== "generating") {
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      void supabaseRealtime.removeChannel(channel);
    };
  }, [tripId, initialStatus, router]);

  return null;
}
