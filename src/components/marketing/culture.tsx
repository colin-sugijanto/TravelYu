import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Culture() {
  return (
    <section className="section-divider relative overflow-hidden bg-[#0f172a] py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-18 h-56 w-56 rounded-full bg-orange-400/22 blur-[96px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-sky-500/22 blur-[110px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex flex-col items-center gap-16 lg:flex-row lg:gap-24">
          <div className="order-2 relative h-[500px] w-full flex-1 lg:order-1 lg:h-[700px]">
            <div className="absolute right-[10%] top-0 z-20 h-[70%] w-[70%] overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_30px_68px_-28px_rgba(2,6,23,0.85)]">
              <Image
                src="https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=800&auto=format&fit=crop"
                alt="Balinese Dancers"
                fill
                className="object-cover"
              />
            </div>

            <div className="absolute bottom-[5%] left-0 z-30 h-[55%] w-[60%] overflow-hidden rounded-[1.75rem] border-[7px] border-[#0f172a] shadow-[0_28px_56px_-26px_rgba(2,6,23,0.85)]">
              <Image
                src="https://images.unsplash.com/photo-1518002054494-3a6f94352e9d?q=80&w=800&auto=format&fit=crop"
                alt="Indonesian Cuisine"
                fill
                className="object-cover"
              />
            </div>

            <div className="absolute left-[20%] top-[20%] z-0 h-64 w-64 rounded-full bg-orange-500/18 blur-[110px]" />
          </div>

          <div className="order-1 flex-1 lg:order-2">
            <div className="mb-8 inline-flex items-center rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-sm font-medium text-zinc-200 backdrop-blur-sm">
              Pengalaman Imersif
            </div>

            <h2 className="mb-6 text-4xl font-semibold leading-[1.08] tracking-[-0.025em] text-white md:text-5xl lg:text-6xl">
              <span className="text-orange-500">Pengalaman lokal</span>
              <br />
              terkurasi oleh AI
            </h2>

            <p className="mb-10 max-w-xl text-lg leading-relaxed text-zinc-300">
              Jelajahi lebih dari sekadar rute turis. Mesin AI kami menganalisis ribuan titik data untuk menyusun pengalaman yang menghubungkan Anda dengan tradisi lokal, kuliner autentik, dan warisan tersembunyi yang menjadikan Indonesia benar-benar istimewa.
            </p>

            <div className="mb-10 grid grid-cols-2 gap-6 rounded-3xl border border-white/10 bg-white/7 p-6 backdrop-blur-sm sm:gap-8">
              <div>
                <h4 className="mb-1 text-3xl font-bold text-white">17k+</h4>
                <p className="text-sm text-zinc-300 sm:text-base">Pulau untuk dijelajahi</p>
              </div>
              <div>
                <h4 className="mb-1 text-3xl font-bold text-white">300+</h4>
                <p className="text-sm text-zinc-300 sm:text-base">Kelompok etnis</p>
              </div>
            </div>

            <Link
              href="/activities"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-8 font-semibold text-zinc-900 shadow-[0_16px_32px_-20px_rgba(255,255,255,0.6)] transition-all hover:-translate-y-0.5 hover:bg-zinc-100"
            >
              Temukan aktivitas
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
