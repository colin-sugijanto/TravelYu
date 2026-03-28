import { AppShell } from "@/components/layout/shell";
import { Footer } from "@/components/layout/footer";
import Image from "next/image";
import { Waves, Mountain, Camera, Utensils, Compass } from "lucide-react";

export const metadata = {
  title: "Activities - TravelYu",
  description: "Discover amazing things to do on your next trip.",
};

const ACTIVITIES = [
  {
    id: "scuba-diving",
    title: "Menyelam & Snorkeling",
    category: "Olahraga Air",
    icon: Waves,
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800&auto=format&fit=crop",
    count: 142
  },
  {
    id: "hiking",
    title: "Trekking Pegunungan",
    category: "Petualangan",
    icon: Mountain,
    image: "https://images.unsplash.com/photo-1602154663343-89fe0bf541ab?q=80&w=800&auto=format&fit=crop",
    count: 85
  },
  {
    id: "cultural-tours",
    title: "Pengalaman Budaya",
    category: "Budaya",
    icon: Camera,
    image: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?q=80&w=800&auto=format&fit=crop",
    count: 210
  },
  {
    id: "culinary",
    title: "Tur Makanan & Kuliner",
    category: "Makanan",
    icon: Utensils,
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop",
    count: 95
  },
  {
    id: "island-hopping",
    title: "Jelajah Pulau",
    category: "Eksplorasi",
    icon: Compass,
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=800&auto=format&fit=crop",
    count: 64
  }
];

export default function ActivitiesPage() {
  return (
    <AppShell noPadding>
      <div className="min-h-screen pb-16 pt-26 lg:pt-34">
        <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
          
          <div className="max-w-3xl mb-12 lg:mb-20">
            <h1 className="mb-6 text-4xl font-semibold tracking-[-0.03em] text-zinc-900 md:text-5xl lg:text-6xl">
              Aktivitas yang bisa <span className="text-blue-600">Dilakukan</span>
            </h1>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Baik Anda pecinta adrenalin atau penggemar budaya, temukan pengalaman sempurna untuk membuat rencana perjalanan Anda tak terlupakan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8 mb-24">
            {ACTIVITIES.map((activity, i) => {
              const Icon = activity.icon;
              // Make the first two items take more space in a grid
              const spanClass = i < 2 ? "lg:col-span-6" : i === 2 ? "lg:col-span-4" : i === 3 ? "lg:col-span-4" : "lg:col-span-4";
              const heightClass = i < 2 ? "h-80 sm:h-96" : "h-72";

              return (
                <div 
                  key={activity.id}
                  className={`group relative rounded-3xl overflow-hidden shadow-sm transition-all duration-500 ${spanClass}`}
                >
                  <div className={`relative w-full ${heightClass}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/40 to-transparent z-10 transition-opacity duration-300 group-hover:via-zinc-900/50" />
                    <Image 
                      src={activity.image}
                      alt={activity.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 50vw"
                    />
                    
                    <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8 z-20 flex flex-col justify-end h-full">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" />
                          {activity.category}
                        </span>
                        <span className="text-white/80 text-sm font-medium">
                          {activity.count} aktivitas
                        </span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-serif font-semibold text-white mb-2 transition-colors">
                        {activity.title}
                      </h3>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
