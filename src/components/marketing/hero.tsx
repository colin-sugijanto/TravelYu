"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Search } from "lucide-react";

export function Hero() {
  return (
    <section className="relative w-full min-h-[100svh] flex flex-col lg:flex-row items-center justify-center overflow-hidden bg-slate-50 pt-20 pb-16 lg:pt-0 lg:pb-0">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col lg:flex-row items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12 gap-8 lg:gap-12 w-full h-full">
        
        {/* Left Side: Text and Search */}
        <div className="flex-1 flex flex-col items-start text-left max-w-3xl z-10 w-full pt-8 lg:pt-0">
          <h1 className="text-[2.75rem] sm:text-[3.5rem] lg:text-[4.5rem] xl:text-[5.5rem] font-serif font-semibold text-zinc-900 tracking-tight leading-[1.1] sm:leading-[1.05] mb-4 sm:mb-6 lg:mb-8 mt-12 lg:mt-0">
            Agen perjalanan <br className="hidden lg:block" /> AI pribadi Anda 
            untuk <br className="hidden lg:block" /><span className="text-orange-500">Indonesia</span>
          </h1>
          
          <p className="text-zinc-600 text-sm sm:text-base lg:text-lg mb-8 lg:mb-10 leading-relaxed max-w-xl">
            Mengobrol dengan AI cerdas kami untuk menemukan destinasi indah, merancang jadwal perjalanan yang sempurna, dan nikmati perencanaan perjalanan yang mudah.
          </p>

          {/* Action Button */}
          <div className="relative z-20 w-full sm:w-auto">
            <Link 
              href="/trip/new/intake"
              className="mt-1 lg:mt-0 w-full lg:w-auto h-14 px-8 bg-orange-500 text-white rounded-2xl flex items-center justify-center gap-3 font-semibold transition-all hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98]"
            >
              <Search className="w-5 h-5" />
              <span>Mulai Rencanakan Perjalanan</span>
            </Link>
          </div>
        </div>

        {/* Right Side: Image Collage */}
        <div className="flex-1 relative w-full min-h-[400px] h-[400px] sm:h-[450px] lg:h-[650px] mt-12 lg:mt-0 block order-last">
          {/* Main Large Image */}
          <div className="absolute top-0 lg:top-[5%] right-0 lg:right-[5%] w-[85%] lg:w-[70%] h-[75%] lg:h-[65%] rounded-3xl overflow-hidden shadow-2xl z-20 transition-transform hover:-translate-y-2 duration-500">
            <Image 
              src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=1200&auto=format&fit=crop" 
              alt="Bali Temple on the lake" 
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
              priority
              sizes="(max-width: 768px) 85vw, (max-width: 1200px) 45vw, 600px"
            />
            {/* Glassmorphism tag */}
            <div className="absolute bottom-4 left-4 lg:bottom-6 lg:left-6 px-4 py-2 rounded-2xl glass-surface text-white/90 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-medium flex items-center gap-2 shadow-lg">
              <MapPin className="w-3.5 h-3.5" />
              Bali, Indonesia
            </div>
          </div>
          
          {/* Bottom Left Image */}
          <div className="absolute bottom-4 lg:bottom-[10%] left-0 lg:left-[5%] w-[65%] lg:w-[50%] h-[55%] lg:h-[45%] rounded-3xl overflow-hidden shadow-xl z-30 transition-transform hover:-translate-y-2 duration-500 border-4 lg:border-[6px] border-slate-50">
            <Image 
              src="https://plus.unsplash.com/premium_photo-1721311166723-5c408da54364?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" 
              alt="Lombok Island View" 
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
              sizes="(max-width: 768px) 65vw, (max-width: 1200px) 30vw, 400px"
            />
          </div>
          
          {/* Top Left Image (Hidden on very small screens) */}
          <div className="absolute top-[15%] lg:top-[20%] left-[-2%] lg:left-[-5%] w-[45%] lg:w-[35%] h-[35%] lg:h-[30%] rounded-3xl overflow-hidden shadow-lg z-10 transition-transform hover:-translate-y-2 duration-500 hidden sm:block">
            <Image 
              src="https://plus.unsplash.com/premium_photo-1668883189361-9c754861dbd6?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" 
              alt="Nusa Penida Coast" 
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
              sizes="(max-width: 1200px) 25vw, 300px"
            />
          </div>
          
          {/* Decorative floating elements */}
          <div className="absolute -top-10 -right-10 w-40 h-40 lg:w-64 lg:h-64 bg-orange-400 rounded-full blur-[80px] opacity-20 z-0 mix-blend-multiply"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 lg:w-64 lg:h-64 bg-blue-500 rounded-full blur-[80px] opacity-15 z-0 mix-blend-multiply"></div>
        </div>
      </div>
    </section>
  );
}
