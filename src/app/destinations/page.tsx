import { AppShell } from "@/components/layout/shell";
import { Footer } from "@/components/layout/footer";
import Image from "next/image";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Destinations - TravelYu",
  description: "Explore the most beautiful destinations in Indonesia.",
};

const DESTINATIONS = [
  {
    id: "bali",
    name: "Bali",
    description: "Pulau Dewata, termahsyur akan keindahan pegunungan berhutan, teras hijau ikonik, pantai, dan terumbu karang.",
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=1200&auto=format&fit=crop",
    popular: true,
  },
  {
    id: "komodo",
    name: "Pulau Komodo",
    description: "Rumah bagi naga komodo yang ikonik, pantai berpasir merah muda, dan perbukitan terjal yang indah.",
    image: "https://plus.unsplash.com/premium_photo-1668883189361-9c754861dbd6?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    popular: true,
  },
  {
    id: "lombok",
    name: "Lombok",
    description: "Pantai yang asri, Gunung Rinjani yang megah, dan suasana yang santai.",
    image: "https://plus.unsplash.com/premium_photo-1721311166723-5c408da54364?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    popular: false,
  },
  {
    id: "yogyakarta",
    name: "Yogyakarta",
    description: "Jantung budaya Jawa, terkenal akan seni tradisional, Candi Borobudur, dan Prambanan.",
    image: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?q=80&w=800&auto=format&fit=crop",
    popular: true,
  },
  {
    id: "raja-ampat",
    name: "Raja Ampat",
    description: "Surga dunia yang memiliki lebih dari 1.500 pulau kecil mempesona di sekitar empat pulau utamanya.",
    image: "https://images.unsplash.com/photo-1703769605297-cc74106244d9?q=80&w=884&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    popular: false,
  },
  {
    id: "nusa-penida",
    name: "Nusa Penida",
    description: "Tebing menawan, air laut yang sangat jernih, dan pemandangan luar biasa indah dekat dari Bali.",
    image: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?q=80&w=800&auto=format&fit=crop",
    popular: true,
  }
];

export default function DestinationsPage() {
  return (
    <AppShell noPadding>
      <div className="bg-[#fcfaf8] min-h-screen pt-24 lg:pt-32 pb-16">
        <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
          
          <div className="max-w-3xl mb-12 lg:mb-20 text-center mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-semibold text-zinc-900 tracking-tight mb-6">
              Tempat untuk <span className="text-orange-500">Dikunjungi</span>
            </h1>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Dari hutan rimbun Bali hingga lanskap prasejarah Komodo, temukan destinasi sempurna untuk perjalanan tak terlupakan Anda berikutnya.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-24">
            {DESTINATIONS.map((dest) => (
              <div 
                key={dest.id}
                className="group flex flex-col rounded-3xl overflow-hidden bg-white shadow-sm border border-zinc-100 transition-all duration-300"
              >
                <div className="relative h-64 sm:h-72 w-full overflow-hidden">
                  <Image 
                    src={dest.image}
                    alt={dest.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  {dest.popular && (
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-orange-600 shadow-sm">
                      Populer
                    </div>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-zinc-500 text-sm font-medium mb-3">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    Indonesia
                  </div>
                  <h3 className="text-2xl font-serif font-semibold text-zinc-900 mb-3">{dest.name}</h3>
                  <p className="text-zinc-600 text-sm leading-relaxed mb-6 flex-1">{dest.description}</p>
                </div>
              </div>
            ))}
          </div>
          
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
