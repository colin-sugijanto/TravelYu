"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { MapPin, Calendar, Users, Search } from "lucide-react";

export function Hero() {
  const [location, setLocation] = useState("");
  const [dates, setDates] = useState("");
  const [guests, setGuests] = useState("");

  // Build the search URL with query parameters
  const searchUrl = new URLSearchParams();
  if (location) searchUrl.append("location", location);
  if (dates) searchUrl.append("dates", dates);
  if (guests) searchUrl.append("guests", guests);
  
  const href = `/trip/new/intake${searchUrl.toString() ? `?${searchUrl.toString()}` : ""}`;

  return (
    <section className="relative w-full min-h-[100svh] flex flex-col lg:flex-row items-center justify-center overflow-hidden bg-slate-50 pt-20 pb-16 lg:pt-0 lg:pb-0">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col lg:flex-row items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12 gap-8 lg:gap-12 w-full h-full">
        
        {/* Left Side: Text and Search */}
        <div className="flex-1 flex flex-col items-start text-left max-w-3xl z-10 w-full pt-8 lg:pt-0">
          <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs sm:text-sm text-orange-600 mb-6 lg:mb-8 font-medium shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
            Your journey begins here
          </div>
          
          <h1 className="text-[2.75rem] sm:text-[3.5rem] lg:text-[4.5rem] xl:text-[5.5rem] font-serif font-semibold text-zinc-900 tracking-tight leading-[1.1] sm:leading-[1.05] mb-4 sm:mb-6 lg:mb-8">
            Your personal AI <br className="hidden lg:block" /> travel 
            agent for <br className="hidden lg:block" /><span className="text-orange-500">Indonesia</span>
          </h1>
          
          <p className="text-zinc-600 text-sm sm:text-base lg:text-lg mb-8 lg:mb-10 leading-relaxed max-w-xl">
            Chat with our intelligent AI to discover beautiful destinations, craft perfect personalized itineraries, and experience 
            the joy of hassle-free travel planning.
          </p>

          {/* Multi-input Search Bar */}
          <div className="w-full bg-white rounded-3xl lg:rounded-full p-2 lg:p-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:shadow-xl lg:shadow-zinc-200/50 border border-zinc-100 flex flex-col lg:flex-row items-stretch lg:items-center gap-0 lg:gap-2 relative z-20">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 sm:py-4 lg:py-2 border-b lg:border-b-0 lg:border-r border-zinc-100 focus-within:bg-slate-50 transition-colors rounded-t-2xl lg:rounded-l-full lg:rounded-tr-none">
              <MapPin className="w-5 h-5 text-zinc-400 shrink-0" />
              <div className="flex flex-col text-left w-full">
                <span className="text-xs font-semibold text-zinc-900 mb-0.5">Location</span>
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where are you going?" 
                  className="bg-transparent border-none outline-none text-[13px] sm:text-sm text-zinc-900 placeholder:text-zinc-400 p-0 w-full focus:ring-0 truncate"
                />
              </div>
            </div>
            
            <div className="flex-1 flex items-center gap-3 px-4 py-3 sm:py-4 lg:py-2 border-b lg:border-b-0 lg:border-r border-zinc-100 focus-within:bg-slate-50 transition-colors">
              <Calendar className="w-5 h-5 text-zinc-400 shrink-0" />
              <div className="flex flex-col text-left w-full">
                <span className="text-xs font-semibold text-zinc-900 mb-0.5">Dates</span>
                <input 
                  type="text" 
                  value={dates}
                  onChange={(e) => setDates(e.target.value)}
                  placeholder="Add dates" 
                  className="bg-transparent border-none outline-none text-[13px] sm:text-sm text-zinc-900 placeholder:text-zinc-400 p-0 w-full focus:ring-0 truncate"
                />
              </div>
            </div>
            
            <div className="flex-1 flex items-center gap-3 px-4 py-3 sm:py-4 lg:py-2 mb-2 lg:mb-0 focus-within:bg-slate-50 transition-colors rounded-b-2xl lg:rounded-none">
              <Users className="w-5 h-5 text-zinc-400 shrink-0" />
              <div className="flex flex-col text-left w-full">
                <span className="text-xs font-semibold text-zinc-900 mb-0.5">Guests</span>
                <input 
                  type="text" 
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  placeholder="Add guests" 
                  className="bg-transparent border-none outline-none text-[13px] sm:text-sm text-zinc-900 placeholder:text-zinc-400 p-0 w-full focus:ring-0 truncate"
                />
              </div>
            </div>
            
            <Link 
              href={href}
              className="mt-1 lg:mt-0 w-full lg:w-auto h-12 lg:h-14 px-6 lg:px-8 bg-orange-500 text-white rounded-2xl lg:rounded-full flex items-center justify-center gap-2 font-medium transition-all hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 shrink-0 active:scale-[0.98]"
            >
              <Search className="w-4 h-4 hidden lg:block" />
              <span className="lg:hidden font-semibold">Search Destinations</span>
              <span className="hidden lg:block">Search</span>
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
              src="https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=800&auto=format&fit=crop" 
              alt="Komodo Island View" 
              fill
              className="object-cover hover:scale-105 transition-transform duration-700"
              sizes="(max-width: 768px) 65vw, (max-width: 1200px) 30vw, 400px"
            />
          </div>
          
          {/* Top Left Image (Hidden on very small screens) */}
          <div className="absolute top-[15%] lg:top-[20%] left-[-2%] lg:left-[-5%] w-[45%] lg:w-[35%] h-[35%] lg:h-[30%] rounded-3xl overflow-hidden shadow-lg z-10 transition-transform hover:-translate-y-2 duration-500 hidden sm:block">
            <Image 
              src="https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?q=80&w=600&auto=format&fit=crop" 
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
