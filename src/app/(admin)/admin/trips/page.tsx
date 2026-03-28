import Link from "next/link";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getTrips } from "@/lib/data";
import { formatTripName } from "@/lib/utils";

import { TripApproveButton } from "@/components/admin/trip-approve-button";
import { TripCompleteButton } from "@/components/admin/trip-complete-button";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-purple-100 text-purple-700",
  paid: "bg-yellow-100 text-yellow-700",
  intake: "bg-amber-100 text-amber-700",
  generating: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  active: "bg-teal-100 text-teal-700",
  completed: "bg-zinc-100 text-zinc-600",
};

export default async function AdminTripsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const trips = await getTrips();
  
  const currentFilter = filter ?? "all";
  const filtered = currentFilter === "all" ? trips : trips.filter(t => t.status === currentFilter);

  const filters = [
    { value: "all", label: "Semua" },
    { value: "draft", label: "Draft" },
    { value: "intake", label: "Intake" },
    { value: "paid", label: "Paid" },
    { value: "generating", label: "Generating" },
    { value: "approved", label: "Approved" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <Card className="p-5">
      <CardTitle>Trip Queue</CardTitle>
      <CardText className="mt-1">
        Semua trip · warna badge menunjukkan status saat ini.
      </CardText>
      
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map(f => (
          <Link
            key={f.value}
            href={`/admin/trips${f.value === "all" ? "" : `?filter=${f.value}`}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${currentFilter === f.value ? "bg-[var(--brand)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-soft)]">Tidak ada trip dengan status ini.</p>
        ) : null}
        {filtered.map((trip) => (
          <div key={trip.id} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{formatTripName(trip)}</p>
                <p className="text-xs text-[var(--text-soft)] font-mono">{trip.public_id}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[trip.status] ?? "bg-slate-100 text-slate-600"}`}>
                {trip.status}
              </span>
            </div>
            <p className="text-xs text-[var(--text-soft)]">
              Planning fee baseline: {trip.planning_fee_idr.toLocaleString("id-ID")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/trip/${trip.id}`}
                className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Buka Trip
              </Link>
              {trip.status === "draft" ? <TripApproveButton tripId={trip.id} /> : null}
              {(trip.status === "approved" || trip.status === "active") ? (
                <TripCompleteButton tripId={trip.id} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
