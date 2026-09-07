"use client";

import Image from "next/image";
import Link from "next/link";

// Simple SVG icons to replace lucide ones to avoid version issues
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 6.05 21.2 11 22V14.6H8.2V12.06H11V10.1C11 7.29 12.63 5.75 15.15 5.75C16.36 5.75 17.63 5.97 17.63 5.97V8.7H16.23C14.86 8.7 14.43 9.55 14.43 10.43V12.06H17.5L17.12 14.6H14.43V22C19.38 21.2 23.4 17.06 23.4 12.06C23.4 6.53 18.9 2.04 12 2.04Z"/>
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.46 6C21.69 6.35 20.86 6.58 20 6.69C20.88 6.16 21.56 5.32 21.88 4.31C21.05 4.81 20.13 5.16 19.16 5.36C18.37 4.5 17.26 4 16 4C13.65 4 11.73 5.92 11.73 8.29C11.73 8.63 11.77 8.96 11.84 9.27C8.28 9.09 5.11 7.38 3 4.79C2.63 5.42 2.42 6.16 2.42 6.94C2.42 8.43 3.17 9.75 4.33 10.5C3.62 10.5 2.96 10.3 2.38 10V10.03C2.38 12.11 3.86 13.85 5.82 14.24C5.46 14.34 5.08 14.39 4.69 14.39C4.42 14.39 4.15 14.36 3.89 14.31C4.43 16.05 6.05 17.3 7.96 17.34C6.46 18.52 4.54 19.23 2.46 19.23C2.11 19.23 1.76 19.21 1.42 19.17C3.34 20.4 5.63 21.1 8.09 21.1C16.1 21.1 20.48 14.47 20.48 8.71C20.48 8.52 20.48 8.33 20.47 8.14C21.32 7.53 22.05 6.81 22.46 6Z"/>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

function CurrentYear() {
  return <span>{new Date().getFullYear()}</span>;
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#0f172a] pb-10 pt-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-56 w-56 -translate-x-1/3 rounded-full bg-orange-400/16 blur-[90px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/4 rounded-full bg-blue-500/16 blur-[100px]" />
      </div>

      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="mb-16 grid grid-cols-1 gap-12 border-b border-zinc-800 pb-16 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <div className="mb-6 inline-block rounded-xl bg-white p-2 shadow-[0_10px_26px_-18px_rgba(255,255,255,0.6)]">
              <Image
                src="/logo.png"
                alt="Travel Yu Logo"
                width={180}
                height={50}
                className="h-12 w-auto object-contain mix-blend-multiply md:h-14 lg:h-16"
              />
            </div>

            <p className="text-zinc-400 leading-relaxed mb-8 max-w-sm">
              Pendamping cerdas Anda untuk menemukan, merencanakan, dan menikmati keindahan luar biasa Indonesia.
            </p>

            <div className="flex gap-4">
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-orange-500 hover:text-white">
                <FacebookIcon className="w-5 h-5" />
              </a>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-orange-500 hover:text-white">
                <TwitterIcon className="w-5 h-5" />
              </a>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-orange-500 hover:text-white">
                <InstagramIcon className="w-5 h-5" />
              </a>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-orange-500 hover:text-white">
                <YoutubeIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-2 lg:col-start-6">
            <h4 className="text-white font-semibold mb-6">Perusahaan</h4>
            <ul className="space-y-4">
              <li><Link href="/dashboard" className="text-zinc-400 transition-colors hover:text-white">Mulai Merencanakan</Link></li>
              <li><Link href="/plans" className="text-zinc-400 transition-colors hover:text-white">Paket & Harga</Link></li>
              <li><Link href="/activities" className="text-zinc-400 transition-colors hover:text-white">Aktivitas</Link></li>
              <li><Link href="/destinations" className="text-zinc-400 transition-colors hover:text-white">Destinasi</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-white font-semibold mb-6">Destinasi</h4>
            <ul className="space-y-4">
              <li><Link href="/destinations" className="text-zinc-400 transition-colors hover:text-white">Bali</Link></li>
              <li><Link href="/destinations" className="text-zinc-400 transition-colors hover:text-white">Lombok</Link></li>
              <li><Link href="/destinations" className="text-zinc-400 transition-colors hover:text-white">Yogyakarta</Link></li>
              <li><Link href="/destinations" className="text-zinc-400 transition-colors hover:text-white">Raja Ampat</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-3 lg:col-start-10">
            <h4 className="text-white font-semibold mb-6">Dukungan</h4>
            <ul className="space-y-4">
              <li><Link href="/dashboard" className="text-zinc-400 transition-colors hover:text-white">Dashboard Saya</Link></li>
              <li><Link href="/profile" className="text-zinc-400 transition-colors hover:text-white">Profil & Bantuan CS</Link></li>
              <li><Link href="/referral" className="text-zinc-400 transition-colors hover:text-white">Referral & Poin</Link></li>
              <li><Link href="/plans" className="text-zinc-400 transition-colors hover:text-white">Kelola Paket</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 text-sm text-zinc-500 md:flex-row">
          <p>© <CurrentYear /> TravelYu. Semua hak dilindungi.</p>

          <div className="flex items-center gap-2">
            <span>Dibuat dengan</span>
            <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <span>di Indonesia</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
