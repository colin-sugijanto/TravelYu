"use client";

export default function AdminFlaggedError() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">Flagged queue gagal dimuat</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi kesalahan saat mengambil queue flagged. Silakan refresh halaman.
      </p>
    </div>
  );
}
