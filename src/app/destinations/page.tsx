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
    description: "The Island of Gods, known for its forested volcanic mountains, iconic rice paddies, beaches and coral reefs.",
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=1200&auto=format&fit=crop",
    popular: true,
  },
  {
    id: "komodo",
    name: "Komodo Island",
    description: "Home to the famous Komodo dragons, pink sand beaches, and rugged hillsides.",
    image: "https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=800&auto=format&fit=crop",
    popular: true,
  },
  {
    id: "lombok",
    name: "Lombok",
    description: "Unspoiled beaches, the majestic Mount Rinjani, and a laid-back vibe.",
    image: "https://images.unsplash.com/photo-1576675466969-38eeae4ba2aa?q=80&w=800&auto=format&fit=crop",
    popular: false,
  },
  {
    id: "yogyakarta",
    name: "Yogyakarta",
    description: "The cultural heart of Java, famous for traditional arts, Borobudur, and Prambanan temples.",
    image: "https://images.unsplash.com/photo-1584814515159-86c6d2d46e22?q=80&w=800&auto=format&fit=crop",
    popular: true,
  },
  {
    id: "raja-ampat",
    name: "Raja Ampat",
    description: "An archipelago comprising over 1,500 small islands, cays, and shoals surrounding four main islands.",
    image: "https://images.unsplash.com/photo-1516690553959-71a414d6b9b6?q=80&w=800&auto=format&fit=crop",
    popular: false,
  },
  {
    id: "nusa-penida",
    name: "Nusa Penida",
    description: "Stunning coastal cliffs, crystal clear waters, and spectacular viewpoints just a boat ride from Bali.",
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
              Places to <span className="text-orange-500">Go</span>
            </h1>
            <p className="text-lg text-zinc-600 leading-relaxed">
              From the lush jungles of Bali to the prehistoric landscapes of Komodo, discover the perfect destination for your next unforgettable journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-24">
            {DESTINATIONS.map((dest) => (
              <Link 
                href={`/destinations/${dest.id}`} 
                key={dest.id}
                className="group flex flex-col rounded-3xl overflow-hidden bg-white shadow-sm border border-zinc-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
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
                      Popular
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
                  
                  <div className="mt-auto flex items-center text-orange-500 font-medium text-sm group-hover:gap-2 transition-all">
                    Explore Destination
                    <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
