import Link from "next/link";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { PointsWidget } from "@/components/loyalty/points-widget";
import { getProfile, getTrips } from "@/lib/data";

export default async function DashboardPage() {
  const [profile, trips] = await Promise.all([getProfile(), getTrips()]);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-5">
          <CardTitle className="text-xl">Halo, {profile.full_name ?? "Traveler"}</CardTitle>
          <CardText className="mt-1">Kelola trip, edit itinerary, dan pantau notifikasi payment/CS dari satu dashboard.</CardText>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/trip/new/intake" className="rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white">
              Mulai Trip Baru
            </Link>
            <Link href="/referral" className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold">
              Referral & Rewards
            </Link>
          </div>
        </Card>

        <PointsWidget points={profile.points_balance} tier={profile.loyalty_tier} />
      </section>

      <Card className="p-5">
        <CardTitle>Your Trips</CardTitle>
        <div className="mt-3 space-y-2">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trip/${trip.id}`}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm transition hover:bg-[var(--bg-alt)]"
            >
              <span className="font-semibold">{trip.public_id}</span>
              <span className="text-[var(--text-soft)]">
                {trip.status} · {trip.payment_status}
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
