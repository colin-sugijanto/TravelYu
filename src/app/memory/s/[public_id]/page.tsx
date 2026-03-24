import { notFound } from "next/navigation";

import { MemoryWall } from "@/components/memory/memory-wall";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getTripById, getTripPhotos } from "@/lib/data";

export default async function SharedMemoryPage({ params }: { params: Promise<{ public_id: string }> }) {
  const { public_id } = await params;
  const trip = await getTripById(public_id);
  if (!trip) notFound();

  const photos = await getTripPhotos(trip.id);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      <Card className="p-5">
        <CardTitle>Shared Memory Wall</CardTitle>
        <CardText className="mt-1">Public ID: {public_id}</CardText>
      </Card>
      <MemoryWall
        tripId={trip.id}
        readOnly
        initialPhotos={photos
          .filter((photo) => Boolean(photo.public_url))
          .map((photo) => ({
            id: photo.id,
            url: photo.public_url as string,
            caption: photo.caption ?? "",
          }))}
      />
    </div>
  );
}
