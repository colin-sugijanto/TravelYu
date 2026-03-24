import Link from "next/link";
import { redirect } from "next/navigation";

import { ComparisonCards } from "@/components/intake/comparison-cards";
import { getComparisonOptions } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function TripComparePage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const { tripId } = await searchParams;
  if (!tripId) {
    redirect("/trip/new/intake");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/trip/new/compare?tripId=${tripId}`)}`);
  }

  const resolvedTripId = tripId;

  const { data: trip } = await supabase.from("trips").select("id,user_id,payment_status").eq("id", resolvedTripId).maybeSingle();
  if (!trip || trip.user_id !== user.id) {
    redirect("/dashboard");
  }

  const options = await getComparisonOptions(resolvedTripId);

  return (
    <div className="space-y-4">
      <ComparisonCards tripId={resolvedTripId} options={options} />
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
