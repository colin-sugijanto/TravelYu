import Link from "next/link";
import Image from "next/image";
import { Show, UserButton } from "@clerk/nextjs";
import { MobileMenu } from "./mobile-menu";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm border-b border-zinc-100 py-1 sm:py-2">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Logo and Main Nav */}
        <div className="flex items-center gap-4 md:gap-8 lg:gap-12">
          {/* Mobile Menu Button */}
          <MobileMenu />

          <Link href="/" className="inline-flex items-center group relative z-50">
            <Image 
              src="/logo.png" 
              alt="Travel Yu Logo" 
              width={260} 
              height={75} 
              className="object-contain mix-blend-multiply transition-transform group-hover:scale-105 h-12 sm:h-14 md:h-16 lg:h-18 w-auto"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-6 lg:gap-8 md:flex">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900">
              Dashboard
            </Link>
            <Link href="/admin" className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900">
              Admin
            </Link>
            <Link href="/trip/new/intake" className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900">
              Rencanakan Perjalanan
            </Link>
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4 md:gap-6">

          <Show when="signed-out">
            <Link
              href="/login?next=%2Fdashboard"
              className="text-sm font-medium text-zinc-800 transition-colors hover:text-zinc-900"
            >
              Masuk
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