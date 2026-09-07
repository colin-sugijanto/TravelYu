import { redirect } from "next/navigation";
import { BudgetTracker } from "@/components/itinerary/budget-tracker";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { getItineraryItems, getTripById } from "@/lib/data";
import { isTripMember } from "@/lib/trip-access";

export default async function TripBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect(`/login?next=${encodeURIComponent(`/trip/${id}/budget`)}`);
  }

  const trip = await getTripById(id);
  if (!trip) {
    redirect("/dashboard");
  }

  const isAdmin = isAdminRole(appUser.role);
  const isOwner = trip.user_id === appUser.id;
  if (!isAdmin && !isOwner) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) {
      redirect("/dashboard");
    }
  }

  const items = await getItineraryItems(trip.id);
  return <BudgetTracker totalBudgetIdr={trip.total_est_cost_idr ?? 15000000} items={items} />;
}
