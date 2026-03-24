import { notFound } from "next/navigation";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { ItineraryTimeline } from "@/components/itinerary/timeline";
import { getItineraryItems, getTripById } from "@/lib/data";

export default async function SharedTripPage({ params }: { params: Promise<{ public_id: string }> }) {
  const { public_id } = await params;
  const trip = await getTripById(public_id);
  if (!trip) notFound();

  const items = await getItineraryItems(trip.id);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      <Card className="p-5">
        <CardTitle>Shared Itinerary</CardTitle>
        <CardText className="mt-1">Public ID: {public_id}</CardText>
      </Card>
      <ItineraryTimeline items={items} />
    </div>
  );
}
