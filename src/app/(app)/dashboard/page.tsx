import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { PointsWidget } from "@/components/loyalty/points-widget";
import { getCurrentAppUser } from "@/lib/auth";
import { getProfile, getTrips } from "@/lib/data";
import { ArrowRight, PlaneTakeoff, Gift, MapPin } from "lucide-react";
import { formatTripName } from "@/lib/utils";

export default async function DashboardPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect("/login?next=%2Fdashboard");
  }

  const [profile, trips] = await Promise.all([getProfile(appUser.id), getTrips()]);

  // Use the freshest name: prefer DB full_name if it's not a Clerk user_xxx ID, else fallback to Clerk name or 'Traveler'
  const isClerkId = (name: string | null) => !name || name.startsWith("user_") || name.length > 40;
  const displayName = isClerkId(profile.full_name)
    ? (isClerkId(appUser.fullName) ? "Traveler" : (appUser.fullName ?? "Traveler"))
    : profile.full_name;

  const STATUS_LABELS: Record<string, string> = {
    intake: "Perencanaan",
    compare: "Pilih Opsi",
    confirmed: "Dikonfirmasi",
    active: "Aktif",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-8 border-transparent shadow-md bg-white">
          <CardTitle className="text-2xl font-bold tracking-tight">Halo, {displayName} 👋</CardTitle>
          <CardText className="mt-2 text-base">Kelola trip, edit itinerary, dan pantau notifikasi dari satu dashboard.</CardText>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link href="/trip/new/intake" className="group flex items-center justify-between rounded-xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-5 py-4 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
              <span className="flex items-center gap-2"><PlaneTakeoff className="w-5 h-5" /> Mulai Trip Baru</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/referral" className="group flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-5 py-4 text-sm font-bold text-[var(--text)] transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm">
              <span className="flex items-center gap-2"><Gift className="w-5 h-5 text-[var(--accent-sky)]" /> Referral & Hadiah</span>
              <ArrowRight className="w-4 h-4 text-slate-400 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Card>

        <PointsWidget points={profile.points_balance} tier={profile.loyalty_tier} />
      </section>

      <Card className="p-8 border-transparent shadow-sm bg-white">
        <CardTitle className="text-xl font-bold mb-4">Trip Kamu</CardTitle>
        <div className="space-y-3">
          {trips.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
              <p className="text-[var(--text-soft)] font-medium">Belum ada trip. Yuk mulai rencanakan liburanmu!</p>
            </div>
          ) : (
            trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trip/${trip.id}`}
                className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white px-5 py-4 text-sm transition-all hover:bg-blue-50 hover:border-blue-100 hover:shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base text-[var(--text)] group-hover:text-[var(--brand-blue)] transition-colors truncate">
                      {formatTripName(trip)}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5 font-mono">{trip.public_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 uppercase tracking-wide">{STATUS_LABELS[trip.status] ?? trip.status}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[var(--brand-blue)]" />
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
