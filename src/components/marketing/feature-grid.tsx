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
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {features.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.title} className="p-5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9efe4] text-[var(--brand-strong)]">
              <Icon className="h-5 w-5" />
            </span>
            <CardTitle className="mt-3 text-base">{item.title}</CardTitle>
            <CardText className="mt-2">{item.body}</CardText>
          </Card>
        );
      })}
    </section>
  );
}
