"use client";

export default function MemoryError() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">Memory wall gagal dimuat</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi kesalahan saat mengambil foto trip. Silakan refresh halaman.
      </p>
    </div>
  );
}
