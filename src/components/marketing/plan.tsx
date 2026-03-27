import Link from "next/link";
import { Sparkles, Map, Compass, Camera } from "lucide-react";

export function Plan() {
  const steps = [
    {
      icon: <Sparkles className="w-6 h-6 text-orange-500" />,
      title: "Ceritakan impian Anda",
      description: "Ngobrol dengan agen AI kami untuk berbagi gaya perjalanan, minat, tanggal, dan anggaran Anda."
    },
    {
      icon: <Map className="w-6 h-6 text-blue-500" />,
      title: "Bandingkan opsi AI",
      description: "AI kami menghasilkan beberapa rencana perjalanan harian yang dipersonalisasi. Bandingkan dan pilih favorit Anda."
    },
    {
      icon: <Compass className="w-6 h-6 text-green-500" />,
      title: "Sempurnakan dengan AI",
      description: "Gunakan editor pintar kami. Minta AI untuk meregenerasi hari tertentu, menukar aktivitas, atau mencari restoran."
    },
    {
      icon: <Camera className="w-6 h-6 text-purple-500" />,
      title: "Pesan dan berangkat",
      description: "Semuanya terorganisir. Ekspor rencana Anda ke PDF, pesan aktivitas Anda secara langsung, dan mulai menjelajah."
    }
  ];

  return (
    <section className="py-24 bg-orange-50/50 relative">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold text-zinc-900 mb-6">
            Cara kerja agen perjalanan AI kami
          </h2>
          <p className="text-zinc-600 text-lg">
            Ucapkan selamat tinggal pada tab yang tak ada habisnya. Biarkan asisten AI cerdas kami mendesain rencana liburan sempurna Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="bg-white rounded-3xl p-8 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center mb-6">
                {step.icon}
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">{step.title}</h3>
              <p className="text-zinc-600 leading-relaxed">
                {step.description}
              </p>
              
              {/* Connecting line (hidden on mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 border-t-2 border-dashed border-zinc-200"></div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            href="/trip/new/intake"
            className="inline-flex items-center justify-center h-14 px-8 bg-zinc-900 text-white rounded-full font-semibold transition-all hover:bg-zinc-800 hover:scale-[1.02] shadow-lg shadow-zinc-900/20 w-full sm:w-auto"
          >
            Mulai Rencanakan dengan AI
          </Link>
          <Link 
            href="/trip/new/intake?mode=surprise"
            className="inline-flex items-center justify-center h-14 px-8 bg-orange-100 text-orange-700 rounded-full font-semibold transition-all hover:bg-orange-200 hover:scale-[1.02] w-full sm:w-auto"
          >
            Kejutkan Saya
          </Link>
        </div>
      </div>
    </section>
  );
}
