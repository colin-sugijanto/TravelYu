import Link from "next/link";
import { Sparkles, Map, Compass, Camera } from "lucide-react";

export function Plan() {
  const steps = [
    {
      icon: <Sparkles className="w-6 h-6 text-orange-500" />,
      title: "Tell AI your dreams",
      description: "Chat with our AI agent to share your travel style, interests, dates, and budget. It actively listens and suggests ideas."
    },
    {
      icon: <Map className="w-6 h-6 text-blue-500" />,
      title: "Compare AI options",
      description: "Our AI generates multiple personalized day-by-day itineraries. Compare them and pick your favorite starting point."
    },
    {
      icon: <Compass className="w-6 h-6 text-green-500" />,
      title: "Refine with AI Editor",
      description: "Use the smart drag-and-drop editor. Ask the AI to regenerate specific days, swap activities, or find better restaurants."
    },
    {
      icon: <Camera className="w-6 h-6 text-purple-500" />,
      title: "Book and go",
      description: "Everything is organized. Export your plan to PDF, book your activities directly, and start exploring with confidence."
    }
  ];

  return (
    <section className="py-24 bg-orange-50/50 relative">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold text-zinc-900 mb-6">
            How our AI travel agent works
          </h2>
          <p className="text-zinc-600 text-lg">
            Say goodbye to endless tabs and stressful planning. Let our intelligent AI assistant design, refine, and organize your perfect getaway.
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
            Chat with AI Planner
          </Link>
          <Link 
            href="/trip/new/intake?mode=surprise"
            className="inline-flex items-center justify-center h-14 px-8 bg-orange-100 text-orange-700 rounded-full font-semibold transition-all hover:bg-orange-200 hover:scale-[1.02] w-full sm:w-auto"
          >
            Surprise Me
          </Link>
        </div>
      </div>
    </section>
  );
}
