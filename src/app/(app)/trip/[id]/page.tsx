import { BudgetTracker } from "@/components/itinerary/budget-tracker";
import { EditorChat } from "@/components/itinerary/editor-chat";
import { ItineraryMap } from "@/components/itinerary/map";
import { ItineraryTimeline } from "@/components/itinerary/timeline";
import { Card, CardTitle } from "@/components/ui/card";
import { WeatherBanner } from "@/components/weather/weather-banner";
import { getItineraryItems, getTripById } from "@/lib/data";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await getTripById(id);
  const items = await getItineraryItems(trip?.id ?? "trip_01");

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardTitle className="text-xl">Trip Workspace · {trip?.public_id ?? id}</CardTitle>
        <div className="mt-3">
          <WeatherBanner
            city="Bali"
            condition="rain"
            advice="Ada potensi hujan sore 70% di day 2-3. Disarankan pindahkan outdoor attraction ke pagi hari."
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <ItineraryTimeline items={items} />
          <ItineraryMap items={items} />
        </div>
        <div className="space-y-4">
          <EditorChat tripId={trip?.id ?? "trip_01"} />
          <BudgetTracker totalBudgetIdr={15000000} items={items} />
        </div>
      </div>
    </div>
  );
}
