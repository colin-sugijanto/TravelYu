import Link from "next/link";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getTrips } from "@/lib/data";
import { formatTripName } from "@/lib/utils";

import { TripApproveButton } from "@/components/admin/trip-approve-button";

export default async function AdminTripsPage() {
  const trips = await getTrips();

  return (
    <Card className="p-5">
      <CardTitle>Trip Queue</CardTitle>
      <CardText className="mt-1">Filter status: draft, paid, approved, active, completed</CardText>
      <div className="mt-3 space-y-2">
        {trips.map((trip) => (
          <div key={trip.id} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{formatTripName(trip)}</p>
                <p className="text-xs text-[var(--text-soft)] font-mono">{trip.public_id}</p>
              </div>
              <span className="text-[var(--text-soft)] uppercase text-xs font-semibold">{trip.status}</span>
            </div>
            <p className="text-xs text-[var(--text-soft)]">Planning fee baseline: {trip.planning_fee_idr.toLocaleString("id-ID")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href={`/trip/${trip.id}`}
                className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Buka Trip
              </Link>
              {trip.status === "draft" ? <TripApproveButton tripId={trip.id} /> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
