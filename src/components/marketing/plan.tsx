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
    <section className="section-divider relative py-24">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] text-zinc-900 md:text-4xl lg:text-5xl">
            Cara kerja agen perjalanan AI kami
          </h2>

          <p className="mt-6 text-lg text-zinc-600">
            Ucapkan selamat tinggal pada tab yang tak ada habisnya. Biarkan asisten AI cerdas kami mendesain rencana liburan sempurna Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative z-10 rounded-[1.8rem] border border-slate-100 bg-white p-8 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.34)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_42px_-24px_rgba(15,23,42,0.4)]"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
                {step.icon}
              </div>

              <h3 className="mb-3 text-xl font-semibold tracking-[-0.01em] text-zinc-900">{step.title}</h3>
              <p className="leading-relaxed text-zinc-600">
                {step.description}
              </p>

              {index < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 hidden w-8 border-t-2 border-dashed border-zinc-200 lg:block" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center sm:flex-row">
          <Link
            href="/trip/new/intake"
            className="inline-flex h-14 w-full items-center justify-center rounded-full bg-zinc-900 px-8 font-semibold text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.65)] transition-all hover:-translate-y-0.5 hover:bg-zinc-800 sm:w-auto"
          >
            Mulai Rencanakan dengan AI
          </Link>

          <Link
            href="/trip/new/intake?mode=surprise"
            className="inline-flex h-14 w-full items-center justify-center rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-8 font-semibold text-[var(--brand-strong)] transition-all hover:-translate-y-0.5 hover:bg-white sm:w-auto"
          >
            Kejutkan Saya
          </Link>
        </div>
      </div>
    </section>
  );
}
