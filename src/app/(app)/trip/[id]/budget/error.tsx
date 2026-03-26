"use client";

export default function BudgetError() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">Budget tracker gagal dimuat</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi kesalahan saat mengambil data budget. Silakan refresh halaman.
      </p>
    </div>
  );
}
