"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VIBE_OPTIONS = [
  { value: "healing", label: "🧘 Healing" },
  { value: "adventure", label: "🏔️ Adventure" },
  { value: "kuliner", label: "🍜 Kuliner" },
  { value: "budaya", label: "🎭 Budaya" },
  { value: "romantic", label: "💑 Romantic" },
  { value: "keluarga", label: "👨‍👩‍👧 Keluarga" },
];

const BUDGET_TIER_OPTIONS = [
  { value: "budget", label: "💰 Hemat (< Rp 1,5jt/org/hari)" },
  { value: "mid", label: "💳 Menengah (Rp 1,5–4jt/org/hari)" },
  { value: "premium", label: "✨ Premium (> Rp 4jt/org/hari)" },
];

export function OnboardingModal() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [budgetTier, setBudgetTier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleVibe = (vibe: string) => {
    setVibes((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!whatsapp.trim()) {
      setError("Nomor WhatsApp wajib diisi supaya kami bisa mengirim notifikasi tripmu.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim() || undefined,
          whatsapp_number: whatsapp.trim(),
          travel_preferences: {
            vibe: vibes.length > 0 ? vibes : undefined,
            budget_tier: budgetTier || undefined,
          },
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Terjadi kesalahan. Coba lagi.");
        return;
      }

      // Refresh server data and close modal
      router.refresh();
    } catch {
      setError("Gagal menyimpan profil. Cek koneksi internetmu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-6 pt-8 pb-6 text-white">
          <div className="text-3xl mb-2">🌴</div>
          <h2 id="onboarding-title" className="text-xl font-bold">
            Selamat datang di TravelYu!
          </h2>
          <p className="text-orange-100 text-sm mt-1">
            Ceritakan sedikit tentang dirimu supaya AI bisa merencanakan trip yang sempurna. Dapatkan{" "}
            <span className="font-bold text-white">25 poin</span> gratis!
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 px-6 pt-4">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-orange-500" : "bg-zinc-200"
              }`}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label htmlFor="onboarding-name" className="block text-sm font-semibold text-zinc-700 mb-1">
                  Nama lengkap <span className="text-zinc-400 font-normal">(opsional)</span>
                </label>
                <input
                  id="onboarding-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama travelingmu"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label htmlFor="onboarding-wa" className="block text-sm font-semibold text-zinc-700 mb-1">
                  Nomor WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  id="onboarding-wa"
                  type="tel"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="08xxxxxxxx atau +628xxxxxxxx"
                  required
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  Untuk pengiriman notifikasi itinerary via WhatsApp.
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!whatsapp.trim()) {
                    setError("Nomor WhatsApp wajib diisi.");
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
              >
                Lanjut →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="text-sm font-semibold text-zinc-700 mb-2">
                  Vibe traveling kamu? <span className="text-zinc-400 font-normal">(boleh pilih beberapa)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {VIBE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleVibe(opt.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        vibes.includes(opt.value)
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-orange-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-700 mb-2">Budget preference:</p>
                <div className="space-y-2">
                  {BUDGET_TIER_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                        budgetTier === opt.value
                          ? "border-orange-400 bg-orange-50"
                          : "border-zinc-200 hover:border-orange-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="budget_tier"
                        value={opt.value}
                        checked={budgetTier === opt.value}
                        onChange={() => setBudgetTier(opt.value)}
                        className="accent-orange-500"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  ← Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Menyimpan..." : "🎉 Mulai Petualangan!"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
