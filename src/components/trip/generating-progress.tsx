"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "🗺️ Memilih aktivitas terbaik untuk kamu...",
  "📅 Menyusun jadwal harian yang optimal...",
  "🌤️ Mengecek cuaca dan kondisi lokal...",
  "🍜 Menemukan kuliner lokal terbaik...",
  "🏨 Mencocokkan akomodasi sesuai budget...",
  "✨ Hampir selesai! Memfinalisasi budget...",
];

/**
 * Shows rotating progress messages while AI is generating the itinerary.
 * Also displays an elapsed time counter and estimated wait time.
 */
export function GeneratingProgressClient() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 4000);

    const elapsedTimer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(msgTimer);
      clearInterval(elapsedTimer);
    };
  }, []);

  const formatElapsed = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-blue-700 text-sm font-medium animate-pulse">
          {MESSAGES[msgIndex]}
        </p>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>Waktu berlalu: {formatElapsed(elapsed)}</span>
        <span>Perkiraan: ±5 menit</span>
      </div>
    </div>
  );
}
