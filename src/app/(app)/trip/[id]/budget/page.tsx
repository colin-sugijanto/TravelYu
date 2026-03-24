import { BudgetTracker } from "@/components/itinerary/budget-tracker";
import { getItineraryItems } from "@/lib/data";

export default async function TripBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await getItineraryItems(id);
  return <BudgetTracker totalBudgetIdr={15000000} items={items} />;
}
