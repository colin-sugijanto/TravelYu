import Link from "next/link";

import { ComparisonCards } from "@/components/intake/comparison-cards";
import { getComparisonOptions } from "@/lib/data";

export default async function TripComparePage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const { tripId } = await searchParams;
  const resolvedTripId = tripId ?? "trip_01";
  const options = await getComparisonOptions(resolvedTripId);

  return (
    <div className="space-y-4">
      <ComparisonCards options={options} />
      <div className="flex justify-end">
        <Link
          href={`/trip/new/payment?tripId=${encodeURIComponent(resolvedTripId)}`}
          className="inline-flex rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          Continue to Payment
        </Link>
      </div>
    </div>
  );
}
