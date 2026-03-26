import { Send } from "lucide-react";

export function Newsletter() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bg-orange-50 rounded-[2.5rem] p-8 md:p-16 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-orange-200/50 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-blue-200/40 rounded-full blur-3xl"></div>

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold text-zinc-900 mb-6">
              Get travel inspiration delivered to your inbox
            </h2>
            <p className="text-zinc-600 text-lg mb-10">
              Join thousands of travelers. Get weekly tips, exclusive deals, and curated itineraries directly from our travel experts.
            </p>

            <form className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <input 
                type="email" 
                placeholder="Enter your email address" 
                className="flex-1 h-14 px-6 rounded-full bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-sm"
                required
              />
              <button 
                type="submit"
                className="h-14 px-8 bg-zinc-900 text-white rounded-full font-semibold transition-all hover:bg-zinc-800 flex items-center justify-center gap-2 sm:w-auto shadow-lg shadow-zinc-900/10"
              >
                Subscribe
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-xs text-zinc-500 mt-4">
              By subscribing you agree to our Terms & Conditions and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
