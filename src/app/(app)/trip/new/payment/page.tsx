import { QRISPayment } from "@/components/intake/qris-payment";

export default async function TripPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const { tripId } = await searchParams;
  return <QRISPayment tripId={tripId ?? "trip_01"} amount={149000} />;
}
