import { notFound } from "next/navigation";

import { MemoryWall } from "@/components/memory/memory-wall";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getTripById } from "@/lib/data";

export default async function SharedMemoryPage({ params }: { params: Promise<{ public_id: string }> }) {
  const { public_id } = await params;
  const trip = await getTripById(public_id);
  if (!trip) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      <Card className="p-5">
        <CardTitle>Shared Memory Wall</CardTitle>
        <CardText className="mt-1">Public ID: {public_id}</CardText>
      </Card>
      <MemoryWall />
    </div>
  );
}
