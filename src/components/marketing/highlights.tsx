import Image from "next/image";
import { ArrowRight, Star, Heart } from "lucide-react";
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
      image: "https://images.unsplash.com/photo-1516690553959-71a414d6b9b6?q=80&w=800&auto=format&fit=crop",
      rating: "4.8",
      tags: ["Wildlife", "Diving", "Adventure"]
    },
    {
      title: "Yogyakarta",
      image: "https://images.unsplash.com/photo-1584805721111-e6e2365315be?q=80&w=800&auto=format&fit=crop",
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
              Top destinations for your <br /> next adventure
            </h2>
            <p className="text-zinc-600 text-lg">
              Curated experiences from across Indonesia, handpicked for you.
            </p>
          </div>
          <Link 
            href="/destinations" 
            className="group flex items-center gap-2 text-orange-600 font-semibold hover:text-orange-700 transition-colors"
          >
            See all destinations
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
                <button className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-red-500 transition-colors z-10">
                  <Heart className="w-5 h-5" />
                </button>
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
