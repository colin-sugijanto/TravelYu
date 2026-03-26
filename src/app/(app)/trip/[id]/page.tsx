import { Suspense } from "react";

import { BudgetTracker } from "@/components/itinerary/budget-tracker";
import { EditorChat } from "@/components/itinerary/editor-chat";
import { ItineraryMap } from "@/components/itinerary/map";
import { ItineraryTimeline } from "@/components/itinerary/timeline";
import { Card, CardTitle } from "@/components/ui/card";
import { WeatherBanner } from "@/components/weather/weather-banner";
import { getCurrentAppUser } from "@/lib/auth";
import { getItineraryItems, getTripById } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

async function TimelineSection({ tripId }: { tripId: string }) {
  const items = await getItineraryItems(tripId);
  return <ItineraryTimeline items={items} />;
}

async function MapSection({ tripId }: { tripId: string }) {
  const items = await getItineraryItems(tripId);
  return <ItineraryMap items={items} />;
}

async function BudgetSection({ tripId }: { tripId: string }) {
  const items = await getItineraryItems(tripId);
  return <BudgetTracker totalBudgetIdr={15000000} items={items} />;
}

function TimelineSkeleton() {
  return (
    <Card className="p-4">
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-24 rounded-xl bg-[var(--bg-alt)]" />
        ))}
      </div>
    </Card>
  );
}

function PanelSkeleton() {
  return (
    <Card className="p-4">
      <div className="h-72 rounded-xl bg-[var(--bg-alt)] animate-pulse" />
    </Card>
  );
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    redirect(`/login?next=${encodeURIComponent(`/trip/${id}`)}`);
  }

  const trip = await getTripById(id);
  if (!trip) {
    redirect("/dashboard");
  }

  const isOwner = trip.user_id === appUser.id;
  if (!isOwner) {
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
          <Suspense fallback={<TimelineSkeleton />}>
            <TimelineSection tripId={trip.id} />
          </Suspense>

          <Suspense fallback={<PanelSkeleton />}>
            <MapSection tripId={trip.id} />
          </Suspense>
        </div>

        <div className="space-y-4">
          <EditorChat tripId={trip.id} userId={appUser.id} />

          <Suspense fallback={<PanelSkeleton />}>
            <BudgetSection tripId={trip.id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
