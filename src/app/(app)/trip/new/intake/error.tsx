"use client";

export default function IntakeError() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">Intake gagal dimuat</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi masalah saat menyiapkan sesi intake. Coba refresh halaman.
      </p>
    </div>
  );
}
