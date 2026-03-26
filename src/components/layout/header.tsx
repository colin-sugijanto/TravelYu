import Link from "next/link";
import Image from "next/image";
import { Show, UserButton } from "@clerk/nextjs";
import { MobileMenu } from "./mobile-menu";

export function AppHeader() {
  return (
    <header className="absolute top-0 z-50 w-full bg-transparent">
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-4 py-4 md:py-6 md:px-8 xl:px-12">
        {/* Logo and Main Nav */}
        <div className="flex items-center gap-4 md:gap-8 lg:gap-12">
          {/* Mobile Menu Button */}
          <MobileMenu />

          <Link href="/" className="inline-flex items-center group relative z-50">
            <Image 
              src="/logo.png" 
              alt="Travel Yu Logo" 
              width={160} 
              height={45} 
              className="object-contain mix-blend-multiply transition-transform group-hover:scale-105 h-7 sm:h-8 md:h-10 w-auto"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-6 lg:gap-8 md:flex">
            <Link href="/destinations" className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900">
              Places to go
            </Link>
            <Link href="/activities" className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900">
              Things to do
            </Link>
            <Link href="/trip/new/intake" className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900">
              Plan your trip
            </Link>
            <Link href="/guide" className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900">
              Traveler&apos;s Guide
            </Link>
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4 md:gap-6">
          <button className="hidden md:flex items-center gap-2 text-sm font-medium text-zinc-800 hover:text-zinc-900">
            <span>ENG</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          
          <button className="text-zinc-800 hover:text-zinc-900 hidden sm:block">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>

          <Show when="signed-out">
            <Link
              href="/login?next=%2Fdashboard"
              className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900"
            >
              Login
            </Link>
          </Show>
          <Show when="signed-in">
            <div className="pl-2 md:pl-4 border-l border-zinc-200">
              <UserButton />
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
}