import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getTrips } from "@/lib/data";

export default async function AdminTripsPage() {
  const trips = await getTrips();

  return (
    <Card className="p-5">
      <CardTitle>Trip Queue</CardTitle>
      <CardText className="mt-1">Filter status: draft, paid, approved, active, completed</CardText>
      <div className="mt-3 space-y-2">
        {trips.map((trip) => (
          <div key={trip.id} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{trip.public_id}</span>
              <span className="text-[var(--text-soft)]">{trip.status}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
