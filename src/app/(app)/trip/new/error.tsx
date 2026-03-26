"use client";

export default function NewTripError() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">Gagal menyiapkan trip baru</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi kesalahan saat membuat draft trip. Coba lagi.
      </p>
    </div>
  );
}
