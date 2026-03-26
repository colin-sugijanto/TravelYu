"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button 
        className="md:hidden text-zinc-800 hover:text-zinc-900 z-50 relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle mobile menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Fullscreen Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-24 px-6 pb-6 flex flex-col md:hidden">
          <nav className="flex flex-col gap-6 text-lg font-medium">
            <Link 
              href="/destinations" 
              className={`transition-colors hover:text-orange-500 ${pathname === '/destinations' ? 'text-orange-500' : 'text-zinc-800'}`}
              onClick={() => setIsOpen(false)}
            >
              Places to go
            </Link>
            <Link 
              href="/activities" 
              className={`transition-colors hover:text-orange-500 ${pathname === '/activities' ? 'text-orange-500' : 'text-zinc-800'}`}
              onClick={() => setIsOpen(false)}
            >
              Things to do
            </Link>
            <Link 
              href="/trip/new/intake" 
              className={`transition-colors hover:text-orange-500 ${pathname === '/trip/new/intake' ? 'text-orange-500' : 'text-zinc-800'}`}
              onClick={() => setIsOpen(false)}
            >
              Plan your trip
            </Link>
            <Link 
              href="/guide" 
              className={`transition-colors hover:text-orange-500 ${pathname === '/guide' ? 'text-orange-500' : 'text-zinc-800'}`}
              onClick={() => setIsOpen(false)}
            >
              Traveler&apos;s Guide
            </Link>
          </nav>
          
          <div className="mt-auto flex flex-col gap-4 border-t border-zinc-100 pt-6">
            <button className="flex items-center gap-2 text-zinc-800 hover:text-orange-500 transition-colors">
              <span>English</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
