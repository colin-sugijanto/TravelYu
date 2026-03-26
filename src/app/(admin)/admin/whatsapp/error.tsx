"use client";

export default function AdminWhatsappError() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">WhatsApp logs gagal dimuat</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi kesalahan saat mengambil log WhatsApp. Silakan refresh halaman.
      </p>
    </div>
  );
}
