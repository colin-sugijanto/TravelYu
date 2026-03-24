import Link from "next/link";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="section-glow overflow-hidden p-7 md:p-10">
        <Badge tone="sun" className="mb-3">
          Indonesia-first AI Travel Planner
        </Badge>
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">
          Rencanakan liburan tanpa ribet, dengan AI + human concierge.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[var(--text-soft)] md:text-base">
          TravelYu mengubah brief sederhana jadi itinerary terkurasi, lengkap dengan budget tracker, packing list,
          dan eskalasi CS real-time via WhatsApp.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/trip/new/intake"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
          >
            Start Standard Mode
          </Link>
          <Link
            href="/trip/new"
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--bg-alt)]"
          >
            Try Surprise Me
          </Link>
        </div>
      </Card>

      <Card className="p-6">
        <CardTitle className="text-lg">TravelYu! At a glance</CardTitle>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-[var(--bg-alt)] p-3">
            <CardText className="text-xs uppercase tracking-wide">AI Intake Completion</CardText>
            <p className="mt-1 text-2xl font-bold">87%</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-alt)] p-3">
            <CardText className="text-xs uppercase tracking-wide">CS Intervention</CardText>
            <p className="mt-1 text-2xl font-bold">18%</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-alt)] p-3">
            <CardText className="text-xs uppercase tracking-wide">Avg Planning Time</CardText>
            <p className="mt-1 text-2xl font-bold">11 min</p>
          </div>
        </div>
      </Card>
    </section>
  );
}
