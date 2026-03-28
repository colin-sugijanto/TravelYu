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
    <section className="section-divider py-24">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] text-zinc-900 md:text-4xl lg:text-5xl">
            Temukan permata tersembunyi
          </h2>

          <p className="mt-6 text-lg text-zinc-600">
            Hindari keramaian dan temukan keindahan alam yang tak tersentuh, direkomendasikan oleh mesin perjalanan cerdas kami.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {gems.map((gem, i) => (
            <article
              key={i}
              className="group relative h-[400px] cursor-pointer overflow-hidden rounded-[1.9rem] border border-white/20 shadow-[0_22px_44px_-28px_rgba(15,23,42,0.54)]"
            >
              <Image
                src={gem.image}
                alt={gem.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/82 via-zinc-900/30 to-transparent" />

              <div className="absolute bottom-0 left-0 w-full translate-y-2 p-6 transition-transform duration-300 group-hover:translate-y-0">
                <p className="mb-1 text-sm font-medium text-orange-300">{gem.location}</p>
                <h3 className="text-xl font-semibold tracking-[-0.01em] text-white">{gem.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
