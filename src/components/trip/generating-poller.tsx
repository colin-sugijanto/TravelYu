"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Polls router.refresh() every 5 seconds while the trip is in "generating" status.
 * Rendered as an invisible component — just side effects.
 */
export function GeneratingPoller() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(id);
  }, [router]);

  return null;
}
