import Image from "next/image";
import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";

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
    <section className="py-24 bg-white relative">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold text-zinc-900 mb-4">
              Destinasi teratas untuk <br /> petualangan Anda berikutnya
            </h2>
            <p className="text-zinc-600 text-lg">
              Pengalaman terkurasi dari seluruh Indonesia, dipilih khusus untuk Anda.
            </p>
          </div>
          <Link 
            href="/destinations" 
            className="group flex items-center gap-2 text-orange-600 font-semibold hover:text-orange-700 transition-colors"
          >
            Lihat semua destinasi
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {destinations.map((dest, i) => (
            <div key={i} className="group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-zinc-50 flex flex-col">
              <div className="relative w-full h-72 lg:h-80 overflow-hidden">
                <Image 
                  src={dest.image}
                  alt={dest.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-sm font-medium flex items-center gap-1.5 z-10">
                  <Star className="w-4 h-4 fill-orange-400 text-orange-400" />
                  {dest.rating}
                </div>
              </div>
              
              <div className="p-6 bg-white flex-1 border border-t-0 border-zinc-100 rounded-b-3xl">
                <div className="flex flex-wrap gap-2 mb-4">
                  {dest.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="text-2xl font-serif font-semibold text-zinc-900 mb-2 group-hover:text-orange-600 transition-colors">
                  {dest.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
