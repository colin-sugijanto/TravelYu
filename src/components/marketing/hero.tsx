"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-26 pb-16 sm:pt-28 lg:pt-34 lg:pb-24">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-16 top-14 h-44 w-44 rounded-full bg-[rgba(249,115,22,0.16)] blur-3xl" />
        <div className="absolute right-0 top-20 h-48 w-48 rounded-full bg-[rgba(37,99,235,0.15)] blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-[90rem] flex-col items-center gap-12 px-4 sm:px-6 lg:flex-row lg:items-start lg:gap-14 lg:px-8 xl:px-12">
        <div className="relative z-10 flex w-full max-w-3xl flex-1 flex-col items-start text-left">
          <h1 className="text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.03em] text-zinc-900 sm:text-[3.45rem] lg:text-[4.65rem] xl:text-[5.25rem]">
            Agen perjalanan <br className="hidden lg:block" /> AI pribadi Anda untuk <br className="hidden lg:block" />
            <span className="text-orange-500">Indonesia</span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base lg:mt-7 lg:text-lg">
            Mengobrol dengan AI cerdas kami untuk menemukan destinasi indah, merancang jadwal perjalanan yang sempurna, dan nikmati perencanaan perjalanan yang mudah.
          </p>

          <div className="relative z-20 mt-8 w-full sm:w-auto lg:mt-10">
            <Link
              href="/trip/new"
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--brand)] px-8 text-base font-semibold text-white shadow-[0_14px_32px_-18px_rgba(249,115,22,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--brand-strong)] hover:shadow-[0_18px_36px_-16px_rgba(249,115,22,0.58)] sm:w-auto"
            >
              <Search className="w-5 h-5" />
              <span>Mulai Rencanakan Perjalanan</span>
            </Link>
          </div>
        </div>

        <div className="relative block h-[420px] w-full flex-1 sm:h-[510px] lg:mt-1 lg:h-[660px]">
          <div className="absolute right-[2%] top-[2%] h-[74%] w-[83%] overflow-hidden rounded-[2rem] border border-white/70 shadow-[0_38px_70px_-36px_rgba(15,23,42,0.58)] z-20 transition-transform duration-500 hover:-translate-y-1.5">
            <Image
              src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=1200&auto=format&fit=crop"
              alt="Bali Temple on the lake"
              fill
              className="object-cover transition-transform duration-700 hover:scale-105"
              priority
              sizes="(max-width: 768px) 85vw, (max-width: 1200px) 45vw, 600px"
            />
            <div className="glass-surface absolute bottom-4 left-4 flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-medium text-zinc-700 shadow-lg sm:text-sm lg:bottom-6 lg:left-6">
              <MapPin className="w-3.5 h-3.5" />
              Bali, Indonesia
            </div>
          </div>

          <div className="absolute bottom-[4%] left-0 z-30 h-[53%] w-[64%] overflow-hidden rounded-[1.8rem] border-4 border-slate-50 shadow-[0_30px_60px_-34px_rgba(15,23,42,0.58)] transition-transform duration-500 hover:-translate-y-1.5 lg:left-[4%] lg:h-[44%] lg:w-[49%] lg:border-[6px]">
            <Image
              src="https://plus.unsplash.com/premium_photo-1721311166723-5c408da54364?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt="Lombok Island View"
              fill
              className="object-cover transition-transform duration-700 hover:scale-105"
              sizes="(max-width: 768px) 65vw, (max-width: 1200px) 30vw, 400px"
            />
          </div>

          <div className="absolute left-[-2%] top-[15%] z-10 hidden h-[35%] w-[45%] overflow-hidden rounded-[1.7rem] border border-white/60 shadow-[0_24px_46px_-32px_rgba(15,23,42,0.62)] transition-transform duration-500 hover:-translate-y-1.5 sm:block lg:left-[-5%] lg:top-[20%] lg:h-[30%] lg:w-[35%]">
            <Image
              src="https://plus.unsplash.com/premium_photo-1668883189361-9c754861dbd6?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt="Nusa Penida Coast"
              fill
              className="object-cover transition-transform duration-700 hover:scale-105"
              sizes="(max-width: 1200px) 25vw, 300px"
            />
          </div>

          <div className="absolute -right-8 -top-8 z-0 h-36 w-36 rounded-full bg-orange-400/24 blur-[76px] lg:h-52 lg:w-52" />
          <div className="absolute -bottom-7 -left-8 z-0 h-36 w-36 rounded-full bg-blue-500/20 blur-[82px] lg:h-56 lg:w-56" />
        </div>
      </div>
    </section>
  );
}
