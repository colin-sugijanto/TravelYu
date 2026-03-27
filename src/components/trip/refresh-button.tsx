"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [rotating, setRotating] = useState(false);

  const handleRefresh = useCallback(() => {
    setRotating(true);
    router.refresh();
    // Stop animation after 1s
    setTimeout(() => setRotating(false), 1000);
  }, [router]);

  return (
    <button
      type="button"
      onClick={handleRefresh}
      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold text-sm hover:bg-zinc-50 transition-colors"
    >
      <RefreshCw className={`w-4 h-4 transition-transform ${rotating ? "animate-spin" : ""}`} />
      Refresh Halaman
    </button>
  );
}
