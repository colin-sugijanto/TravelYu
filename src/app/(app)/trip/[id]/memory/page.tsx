import { MemoryWall } from "@/components/memory/memory-wall";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { getTripById, getTripPhotos } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export default async function TripMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    redirect(`/login?next=${encodeURIComponent(`/trip/${id}/memory`)}`);
  }

  const trip = await getTripById(id);

  if (!trip) {
    redirect("/dashboard");
  }

  const isAdmin = isAdminRole(appUser.role);
  const isOwner = trip.user_id === appUser.id;
  if (!isAdmin && !isOwner) {
    const { data: member } = await supabaseAdmin
      .from("group_trip_members")
      .select("trip_id")
      .eq("trip_id", trip.id)
      .eq("user_id", appUser.id)
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
