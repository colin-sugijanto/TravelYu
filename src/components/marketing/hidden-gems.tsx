import Image from "next/image";

export function HiddenGems() {
  const gems = [
    {
      title: "Pink Beach",
      location: "Komodo National Park",
      image: "https://images.unsplash.com/photo-1700591698351-f8131b0f5d3c?q=80&w=436&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    {
      title: "Mount Bromo",
      location: "East Java",
      image: "https://images.unsplash.com/photo-1602154663343-89fe0bf541ab?q=80&w=800&auto=format&fit=crop"
    },
    {
      title: "Tiu Kelep Waterfall",
      location: "Lombok",
      image: "https://plus.unsplash.com/premium_photo-1674014497100-a2751be936aa?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    {
      title: "Banda Islands",
      location: "West Papua",
      image: "https://images.unsplash.com/photo-1516690553959-71a414d6b9b6?q=80&w=800&auto=format&fit=crop"
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold text-zinc-900 mb-6">
            Temukan permata tersembunyi
          </h2>
          <p className="text-zinc-600 text-lg">
            Hindari keramaian dan temukan keindahan alam yang tak tersentuh, direkomendasikan oleh mesin perjalanan cerdas kami.
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
