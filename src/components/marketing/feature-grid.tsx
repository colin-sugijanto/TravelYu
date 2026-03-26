import { Compass, MessageCircle, Sparkles, Bell } from "lucide-react";

import { Card, CardText, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "Conversational Intake",
    body: "7 parameter trip dikumpulkan natural dalam Bahasa Indonesia.",
    icon: MessageCircle,
  },
  {
    title: "Smart Itinerary Engine",
    body: "Gabungkan vendor internal, web search, dan rules CS approval.",
    icon: Compass,
  },
  {
    title: "Development-First Flow",
    body: "Setelah pilih opsi trip, itinerary langsung digenerate tanpa payment wall.",
    icon: Sparkles,
  },
  {
    title: "Omnichannel Notifications",
    body: "Email, WhatsApp, dan dashboard admin sinkron dari event trip.",
    icon: Bell,
  },
];

export function FeatureGrid() {
  return (
    <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {features.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.title} className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--brand)]/10 border-[var(--border)] bg-white group">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)] transition-colors duration-300 group-hover:bg-[var(--brand)] group-hover:text-white">
              <Icon className="h-6 w-6" />
            </span>
            <CardTitle className="mt-5 text-lg font-bold text-[var(--text)] group-hover:text-[var(--brand-blue)] transition-colors">{item.title}</CardTitle>
            <CardText className="mt-2 text-[var(--text-soft)] leading-relaxed">{item.body}</CardText>
          </Card>
        );
      })}
    </section>
  );
}
