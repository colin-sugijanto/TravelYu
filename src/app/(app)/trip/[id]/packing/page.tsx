import { redirect } from "next/navigation";

import { PackingList } from "@/components/packing/packing-list";
import { getOrGeneratePackingList, getTripById } from "@/lib/data";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { isTripMember } from "@/lib/trip-access";

export default async function TripPackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect(`/login?next=/trip/${id}/packing`);

  const trip = await getTripById(id);
  if (!trip) redirect("/dashboard");

  const isAdmin = isAdminRole(appUser.role);
  const isOwner = trip.user_id === appUser.id;
  if (!isAdmin && !isOwner) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) {
      redirect("/dashboard");
    }
  }

  const items = await getOrGeneratePackingList(trip.id);
  return <PackingList initialItems={items} />;
}
