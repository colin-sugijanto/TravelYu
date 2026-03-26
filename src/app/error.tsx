"use client";

export default function RootError() {
  return (
    <div className="mx-auto w-full max-w-4xl rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">Aplikasi sedang bermasalah</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi kesalahan tak terduga. Silakan refresh halaman dan coba lagi.
      </p>
    </div>
  );
}
