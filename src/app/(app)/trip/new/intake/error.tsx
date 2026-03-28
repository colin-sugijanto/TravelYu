"use client";

export default function IntakeError() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.34)]">
      <h2 className="text-lg font-semibold">Intake gagal dimuat</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi masalah saat menyiapkan sesi intake. Coba refresh halaman.
      </p>
    </div>
  );
}
