import { redirect } from "next/navigation";

import { IntakeChat } from "@/components/intake/intake-chat";
import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier } from "@/lib/trip-access";

async function createDraftTrip(appUserId: string, mode: "standard" | "surprise") {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "trip_01";
  }

  const { data, error } = await supabaseAdmin
    .from("trips")
    .insert({
      user_id: appUserId,
      status: "intake",
      payment_status: "paid",
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
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect("/login?next=%2Ftrip%2Fnew%2Fintake");
  }

  const { mode, tripId: existingTripId } = await searchParams;
  const resolvedMode = mode === "surprise" ? "surprise" : "standard";
  const wantsSurprise = resolvedMode === "surprise";

  const tripId = existingTripId ?? (await createDraftTrip(appUser.id, resolvedMode));

  if (tripId === null) {
    redirect(`/login?next=${encodeURIComponent(`/trip/new/intake?mode=${resolvedMode}`)}`);
  }

  const { data: trip } = await findTripByIdentifier<{
    id: string;
    user_id: string;
    is_surprise_mode: boolean;
    intake_data: Record<string, unknown> | null;
  }>(tripId, "id,user_id,is_surprise_mode,intake_data");

  if (!trip || trip.user_id !== appUser.id) {
    redirect("/dashboard");
  }

  if (trip.is_surprise_mode !== wantsSurprise) {
    const nextIntakeData = {
      ...(trip.intake_data ?? {}),
      surpriseMode: wantsSurprise,
    };

    await supabaseAdmin
      .from("trips")
      .update({
        is_surprise_mode: wantsSurprise,
        intake_data: nextIntakeData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", trip.id);
  }

  return <IntakeChat tripId={tripId} mode={resolvedMode} />;
}
