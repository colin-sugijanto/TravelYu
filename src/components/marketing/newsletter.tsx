"use client";

import { Send } from "lucide-react";

export function Newsletter() {
  return (
    <section className="section-divider py-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/75 bg-[linear-gradient(160deg,#fff7ef_0%,#f8f6ff_100%)] p-8 text-center shadow-[0_26px_54px_-34px_rgba(15,23,42,0.44)] md:p-16">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-200/55 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-blue-200/42 blur-3xl" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-zinc-900 md:text-4xl lg:text-5xl">
              Dapatkan inspirasi perjalanan di kotak masuk Anda
            </h2>

            <p className="mb-10 mt-6 text-lg text-zinc-600">
              Bergabunglah dengan ribuan wisatawan. Dapatkan tips mingguan, penawaran eksklusif, dan rencana perjalanan dari ahli kami.
            </p>

            <form className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto" onSubmit={(e) => { e.preventDefault(); alert("Terima kasih telah berlangganan!"); }}>
              <input
                type="email"
                placeholder="Masukkan alamat email Anda"
                className="h-14 flex-1 rounded-full border border-zinc-200 bg-white px-6 text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />

              <button
                type="submit"
                className="flex h-14 items-center justify-center gap-2 rounded-full bg-zinc-900 px-8 font-semibold text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.62)] transition-all hover:-translate-y-0.5 hover:bg-zinc-800 sm:w-auto"
              >
                Berlangganan
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-4 text-xs text-zinc-500">
              Dengan berlangganan, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi kami.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
