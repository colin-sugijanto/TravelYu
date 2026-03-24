import { redirect } from "next/navigation";

import { QRISPayment } from "@/components/intake/qris-payment";
import { createClient } from "@/lib/supabase/server";

export default async function TripPaymentPage({
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
    redirect(`/login?next=${encodeURIComponent(`/trip/new/payment?tripId=${tripId}`)}`);
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id,user_id,planning_fee_idr,payment_status,selected_comparison_option")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip || trip.user_id !== user.id) {
    redirect("/dashboard");
  }

  const amount = trip.planning_fee_idr > 0 ? trip.planning_fee_idr : 149000;

  return <QRISPayment tripId={tripId} amount={amount} />;
}
