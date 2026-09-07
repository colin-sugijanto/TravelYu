import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { PointsWidget } from "@/components/loyalty/points-widget";
import { ImportTicketCard } from "@/components/vault/import-ticket-card";
import { getCurrentAppUser } from "@/lib/auth";
import { getCreditState } from "@/lib/credits";
import { getProfile, getTripsWithCovers } from "@/lib/data";
import { getPlanConfig } from "@/lib/plans";
import { ArrowRight, PlaneTakeoff, Gift, MapPin, Ticket } from "lucide-react";
import { formatTripName } from "@/lib/utils";
import type { TripWithCover } from "@/types/domain";

const STATUS_LABELS: Record<string, string> = {
  intake: "Perencanaan",
  compare: "Pilih Opsi",
  generating: "Sedang Diproses",
  draft: "Draft",
  approved: "Disetujui",
  confirmed: "Dikonfirmasi",
  active: "Aktif",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

function TripCard({ trip }: { trip: TripWithCover }) {
  return (
    <Link
      href={`/trip/${trip.id}`}
      className="group overflow-hidden rounded-2xl border border-slate-100 bg-white transition-all hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-md"
    >
      <div className="relative h-32 w-full bg-gradient-to-br from-orange-100 via-rose-50 to-sky-100">
        {trip.cover_url ? (
          <Image
            src={trip.cover_url}
            alt={formatTripName(trip)}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">🗺️</div>
        )}
        <span className="absolute left-2 top-2 inline-flex rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
          {STATUS_LABELS[trip.status] ?? trip.status}
        </span>
        {(trip.photo_count ?? 0) > 0 ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
            📷 {trip.photo_count}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--text)] group-hover:text-[var(--brand-blue)]">
              {formatTripName(trip)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-400">{trip.public_id}</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[var(--brand-blue)]" />
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect("/login?next=%2Fdashboard");
  }

  const [profile, trips, creditState] = await Promise.all([
    getProfile(appUser.id),
    getTripsWithCovers(),
    getCreditState(appUser.id),
  ]);
  const planConfig = getPlanConfig(creditState.planTier);

  const isClerkId = (name: string | null) => !name || name.startsWith("user_") || name.length > 40;
  const displayName = isClerkId(profile.full_name)
    ? (isClerkId(appUser.fullName) ? "Traveler" : (appUser.fullName ?? "Traveler"))
    : profile.full_name;

  const active = trips.filter((t) => t.status === "active" || t.status === "approved");
  const planning = trips.filter((t) => ["intake", "compare", "generating", "draft"].includes(t.status));
  const past = trips.filter((t) => t.status === "completed" || t.status === "cancelled");

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-transparent bg-white p-6 shadow-md md:p-8">
          <CardTitle className="text-xl font-bold tracking-tight md:text-2xl">Halo, {displayName} 👋</CardTitle>
          <CardText className="mt-2 text-sm md:text-base">Satu rumah untuk semua trip — yang direncanakan AI maupun tiket aslimu.</CardText>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/trip/new/intake" className="group flex items-center justify-between rounded-xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-5 py-4 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex items-center gap-2"><PlaneTakeoff className="h-5 w-5" /> Mulai Trip Baru</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/trip/new" className="group flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-5 py-4 text-sm font-bold text-[var(--text)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm">
              <span className="flex items-center gap-2"><Ticket className="h-5 w-5 text-[var(--accent-sky)]" /> Import Tiket Saya</span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <Link href="/referral" className="mt-3 hidden items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 sm:inline-flex">
            <Gift className="h-3.5 w-3.5" /> Punya kode referral? Klaim hadiah →
          </Link>
        </Card>

        <div className="space-y-4">
          <PointsWidget points={profile.points_balance} tier={profile.loyalty_tier} />
          <Card className="p-5">
            <p className="text-sm font-bold">
              {planConfig.name} · ⚡ {creditState.balance}/{creditState.quota} kredit AI
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Intake 1 · Komparasi 6 · Generate 25 · Editor 2 · Regen 5 · Parser tiket 3
            </p>
            <Link
              href="/plans"
              className="mt-3 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white"
            >
              {creditState.planTier === "free" ? "Upgrade ke Member/Pro" : "Kelola Paket"}
            </Link>
          </Card>
        </div>
      </section>

      {trips.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ImportTicketCard />
          <Card className="border-transparent bg-white p-8 text-center shadow-sm">
            <p className="text-4xl">✈️</p>
            <p className="mt-2 font-bold">Belum ada trip. Mulai dari mana?</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">Import tiket asli atau biarkan AI merencanakan dari nol — keduanya tersimpan sebagai galeri memorimu.</p>
          </Card>
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <section>
              <h2 className="mb-3 text-base font-extrabold">🚀 Sedang Berjalan ({active.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((trip) => <TripCard key={trip.id} trip={trip} />)}
              </div>
            </section>
          ) : null}

          {planning.length > 0 ? (
            <section>
              <h2 className="mb-3 text-base font-extrabold">✨ Dalam Perencanaan ({planning.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {planning.map((trip) => <TripCard key={trip.id} trip={trip} />)}
              </div>
            </section>
          ) : null}

          {past.length > 0 ? (
            <section>
              <h2 className="mb-3 text-base font-extrabold">📖 Galeri Kenangan ({past.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((trip) => <TripCard key={trip.id} trip={trip} />)}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
