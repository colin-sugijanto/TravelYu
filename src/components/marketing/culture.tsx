import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Culture() {
  return (
    <section className="py-24 bg-zinc-900 relative overflow-hidden">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          
          <div className="flex-1 relative w-full h-[500px] lg:h-[700px] order-2 lg:order-1">
            <div className="absolute top-0 right-[10%] w-[70%] h-[70%] rounded-3xl overflow-hidden shadow-2xl z-20">
              <Image 
                src="https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=800&auto=format&fit=crop" 
                alt="Balinese Dancers" 
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute bottom-[5%] left-0 w-[60%] h-[55%] rounded-3xl overflow-hidden shadow-xl z-30 border-8 border-zinc-900">
              <Image 
                src="https://images.unsplash.com/photo-1518002054494-3a6f94352e9d?q=80&w=800&auto=format&fit=crop" 
                alt="Indonesian Cuisine" 
                fill
                className="object-cover"
              />
            </div>
            {/* Decorative element */}
            <div className="absolute top-[20%] left-[20%] w-64 h-64 bg-orange-500 rounded-full blur-[100px] opacity-20 z-0"></div>
          </div>
          
          <div className="flex-1 order-1 lg:order-2">
            <div className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 mb-8 font-medium backdrop-blur-sm">
              Pengalaman Imersif
            </div>
            
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-semibold text-white mb-6 leading-[1.1]">
              <span className="text-orange-500">Pengalaman lokal</span> <br />
              terkurasi oleh AI
            </h2>
            
            <p className="text-zinc-400 text-lg mb-10 leading-relaxed max-w-xl">
              Jelajahi lebih dari sekadar rute turis. Mesin AI kami menganalisis ribuan titik data untuk menyusun pengalaman yang menghubungkan Anda dengan tradisi lokal, kuliner autentik, dan warisan tersembunyi yang menjadikan Indonesia benar-benar istimewa.
            </p>
            
            <div className="grid grid-cols-2 gap-8 mb-10">
              <div>
                <h4 className="text-3xl font-bold text-white mb-2">17k+</h4>
                <p className="text-zinc-400">Pulau untuk dijelajahi</p>
              </div>
              <div>
                <h4 className="text-3xl font-bold text-white mb-2">300+</h4>
                <p className="text-zinc-400">Kelompok etnis</p>
              </div>
            </div>
            
            <Link 
              href="/activities"
              className="inline-flex items-center justify-center gap-2 h-14 px-8 bg-white text-zinc-900 rounded-full font-semibold transition-all hover:bg-zinc-100 hover:scale-[1.02]"
            >
              Temukan aktivitas
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          
        </div>
      </div>
    </section>
  );
}
