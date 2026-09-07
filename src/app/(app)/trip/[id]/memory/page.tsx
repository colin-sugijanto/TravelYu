import { MemoryScrapbook } from "@/components/memory/memory-scrapbook";
import { MemoryWall } from "@/components/memory/memory-wall";
import { StoryTimeline } from "@/components/memory/story-timeline";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { getItineraryItems, getTripBookings, getTripById, getTripPhotos, getTripTodayNotes } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

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
  const [photos, items, bookings, notes] = await Promise.all([
    getTripPhotos(resolvedTripId),
    getItineraryItems(resolvedTripId),
    getTripBookings(resolvedTripId),
    getTripTodayNotes(resolvedTripId),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold">📖 Galeri & Memori Trip</h1>
          <p className="text-xs text-zinc-500">Storybook otomatis + scrapbook + wall — semua tersimpan permanen di vault-mu.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href={`/trip/${resolvedTripId}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700">
            ← Kembali ke Itinerary
          </Link>
          <a
            href={`/api/trip/${resolvedTripId}/wrapped-image`}
            download
            className="rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1.5 font-bold text-white"
          >
            ⬇ Share Wrapped
          </a>
        </div>
      </div>

      <StoryTimeline tripId={resolvedTripId} items={items} bookings={bookings} photos={photos} notes={notes} />
      <MemoryScrapbook tripId={resolvedTripId} items={items} photos={photos} />
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
    </div>
  );
}
