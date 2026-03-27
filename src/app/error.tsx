"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-orange-200 bg-orange-50 p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
        <AlertTriangle className="h-8 w-8 text-orange-600" />
      </div>

      <h2 className="text-xl font-bold text-orange-900">Ups! Ada masalah</h2>
      
      <p className="mt-3 text-sm text-orange-700">
        Terjadi kesalahan tak terduga. Jangan khawatir, tim kami sudah mencatat error ini.
      </p>

      {error.message && (
        <div className="mt-4 rounded-lg bg-white p-3 text-left">
          <p className="text-xs font-mono text-orange-800 break-all">
            {error.message}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
        >
          <RefreshCcw className="h-4 w-4" />
          Coba Lagi
        </button>
        
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-300 bg-white px-6 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
        >
          <Home className="h-4 w-4" />
          Kembali ke Home
        </Link>
      </div>

      <p className="mt-6 text-xs text-orange-600">
        Jika masalah berlanjut, hubungi support di{" "}
        <a href="mailto:support@travelyu.id" className="underline hover:text-orange-800">
          support@travelyu.id
        </a>
      </p>
    </div>
  );
}
