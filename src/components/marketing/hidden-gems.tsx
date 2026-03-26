import Image from "next/image";

export function HiddenGems() {
  const gems = [
    {
      title: "Pink Beach",
      location: "Komodo National Park",
      image: "https://images.unsplash.com/photo-1552554744-8848db9d6d37?q=80&w=800&auto=format&fit=crop"
    },
    {
      title: "Mount Bromo",
      location: "East Java",
      image: "https://images.unsplash.com/photo-1602154663343-89fe0bf541ab?q=80&w=800&auto=format&fit=crop"
    },
    {
      title: "Tiu Kelep Waterfall",
      location: "Lombok",
      image: "https://images.unsplash.com/photo-1576405368307-e85dfba068ba?q=80&w=800&auto=format&fit=crop"
    },
    {
      title: "Banda Islands",
      location: "West Papua",
      image: "https://images.unsplash.com/photo-1544498322-8356bb711e50?q=80&w=800&auto=format&fit=crop"
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold text-zinc-900 mb-6">
            Discover hidden gems
          </h2>
          <p className="text-zinc-600 text-lg">
            Escape the crowds and find untouched beauty recommended by our intelligent travel engine.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {gems.map((gem, i) => (
            <div key={i} className="group relative h-[400px] rounded-3xl overflow-hidden cursor-pointer">
              <Image 
                src={gem.image}
                alt={gem.title}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-zinc-900/20 to-transparent"></div>
              
              <div className="absolute bottom-0 left-0 w-full p-6 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-orange-400 text-sm font-medium mb-1">{gem.location}</p>
                <h3 className="text-white text-xl font-semibold">{gem.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
