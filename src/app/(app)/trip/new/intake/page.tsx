import { redirect } from "next/navigation";

import { IntakeChat } from "@/components/intake/intake-chat";
import { createClient } from "@/lib/supabase/server";

async function createDraftTrip(mode: "standard" | "surprise") {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "trip_01";
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      status: "intake",
      payment_status: "pending",
      is_surprise_mode: mode === "surprise",
      intake_data: {
        surpriseMode: mode === "surprise",
      },
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return "trip_01";
  }

  return data.id;
}

export default async function TripIntakePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; tripId?: string }>;
}) {
  const { mode, tripId: existingTripId } = await searchParams;
  const resolvedMode = mode === "surprise" ? "surprise" : "standard";

  const tripId = existingTripId ?? (await createDraftTrip(resolvedMode));

  if (tripId === null) {
    redirect(`/login?next=${encodeURIComponent(`/trip/new/intake?mode=${resolvedMode}`)}`);
  }

  return <IntakeChat tripId={tripId} mode={resolvedMode} />;
}
