import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";

export function Highlights() {
  const destinations = [
    {
      title: "Ubud, Bali",
      image: "https://images.unsplash.com/photo-1559628233-eb1b1a45564b?q=80&w=800&auto=format&fit=crop",
      rating: "4.9",
      tags: ["Culture", "Nature", "Relaxation"]
    },
    {
      title: "Raja Ampat",
      image: "https://images.unsplash.com/photo-1703769605297-cc74106244d9?q=80&w=884&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      rating: "4.8",
      tags: ["Wildlife", "Diving", "Adventure"]
    },
    {
      title: "Yogyakarta",
      image: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?q=80&w=800&auto=format&fit=crop",
      rating: "4.7",
      tags: ["Heritage", "Art", "Culinary"]
    }
  ];

  return (
    <section className="section-divider relative py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-44 w-[min(92vw,1100px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-zinc-900 md:text-4xl lg:text-5xl">
              Destinasi teratas untuk <br /> petualangan Anda berikutnya
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Pengalaman terkurasi dari seluruh Indonesia, dipilih khusus untuk Anda.
            </p>
          </div>

          <Link
            href="/destinations"
            className="group inline-flex items-center gap-2 rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-strong)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white"
          >
            Lihat semua destinasi
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {destinations.map((dest, i) => (
            <article
              key={i}
              className="group relative flex flex-col overflow-hidden rounded-[1.85rem] border border-slate-100 bg-white shadow-[0_16px_38px_-30px_rgba(15,23,42,0.36)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_52px_-28px_rgba(15,23,42,0.42)]"
            >
              <div className="relative h-72 w-full overflow-hidden lg:h-80">
                <Image
                  src={dest.image}
                  alt={dest.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/55 via-zinc-900/5 to-transparent" />

                <div className="glass-surface absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-slate-800">
                  <Star className="w-4 h-4 fill-orange-400 text-orange-400" />
                  {dest.rating}
                </div>
              </div>

              <div className="flex flex-1 flex-col rounded-b-[1.85rem] border-t border-slate-100 bg-white p-6">
                <div className="mb-4 flex flex-wrap gap-2">
                  {dest.tags.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-medium text-[var(--brand-strong)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <h3 className="text-2xl font-semibold tracking-[-0.01em] text-zinc-900 transition-colors group-hover:text-[var(--brand-strong)]">
                  {dest.title}
                </h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
