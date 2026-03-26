"use client";

export default function LoginError() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6">
      <h2 className="text-lg font-semibold">Login page gagal dimuat</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Terjadi kesalahan saat menyiapkan halaman login. Silakan refresh halaman.
      </p>
    </div>
  );
}
