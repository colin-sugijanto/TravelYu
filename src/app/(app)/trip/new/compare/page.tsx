import { redirect } from "next/navigation";

import { ComparisonCards } from "@/components/intake/comparison-cards";
import { getCurrentAppUser } from "@/lib/auth";
import { getComparisonOptions } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function TripComparePage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const { tripId } = await searchParams;
  if (!tripId) {
    redirect("/trip/new/intake");
  }

  const appUser = await getCurrentAppUser();

  if (!appUser) {
    redirect(`/login?next=${encodeURIComponent(`/trip/new/compare?tripId=${tripId}`)}`);
  }

  const resolvedTripId = tripId;

  const { data: trip } = await supabaseAdmin.from("trips").select("id,user_id").eq("id", resolvedTripId).maybeSingle();
  if (!trip || trip.user_id !== appUser.id) {
    redirect("/dashboard");
  }

  const options = await getComparisonOptions(resolvedTripId);

  return (
    <ComparisonCards tripId={resolvedTripId} options={options} />
  );
}
