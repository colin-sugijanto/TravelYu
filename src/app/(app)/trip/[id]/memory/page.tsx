import { MemoryWall } from "@/components/memory/memory-wall";
import { getTripById, getTripPhotos } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TripMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/trip/${id}/memory`)}`);
  }

  const trip = await getTripById(id);

  if (!trip) {
    redirect("/dashboard");
  }

  const isOwner = trip.user_id === user.id;
  if (!isOwner) {
    const { data: member } = await supabase
      .from("group_trip_members")
      .select("trip_id")
      .eq("trip_id", trip.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      redirect("/dashboard");
    }
  }

  const resolvedTripId = trip.id;
  const photos = await getTripPhotos(resolvedTripId);

  return (
    <MemoryWall
      tripId={resolvedTripId}
      initialPhotos={photos
        .filter((photo) => Boolean(photo.public_url))
        .map((photo) => ({
          id: photo.id,
          url: photo.public_url as string,
          caption: photo.caption ?? "",
        }))}
    />
  );
}
