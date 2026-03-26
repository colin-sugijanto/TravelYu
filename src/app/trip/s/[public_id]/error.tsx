"use client";

export default function SharedTripError() {
  return (
    <div className="mx-auto w-full max-w-4xl rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">Shared itinerary gagal dimuat</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi kesalahan saat mengambil itinerary publik. Silakan refresh halaman.
      </p>
    </div>
  );
}
