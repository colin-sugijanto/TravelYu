import { redirect } from "next/navigation";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function createTrip(mode: "standard" | "surprise") {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("trips")
    .insert({
      user_id: appUser.id,
      status: "intake",
      payment_status: "paid",
      is_surprise_mode: mode === "surprise",
      intake_data: { surpriseMode: mode === "surprise" },
    })
    .select("id")
    .single();

  if (error || !data?.id) return null;
  return data.id;
}

async function startTrip(mode: "standard" | "surprise") {
  "use server";

  const tripId = await createTrip(mode);
  if (!tripId) {
    redirect(`/login?next=${encodeURIComponent(`/trip/new?mode=${mode}`)}`);
  }

  const urlMode = mode === "surprise" ? "surprise" : "standard";
  redirect(`/trip/new/intake?mode=${urlMode}&tripId=${encodeURIComponent(tripId)}`);
}

export default function NewTripPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5">
        <CardTitle>Standard Mode</CardTitle>
        <CardText className="mt-2">Isi preferensi lengkap via AI chat intake untuk itinerary yang presisi.</CardText>
        <form action={startTrip.bind(null, "standard")} className="mt-4">
          <button type="submit" className="inline-flex rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
            Start Standard
          </button>
        </form>
      </Card>

      <Card className="p-5">
        <CardTitle>Surprise Me Mode</CardTitle>
        <CardText className="mt-2">Cukup berikan budget + tanggal + pax, biarkan AI pilih destinasi Indonesia terbaik.</CardText>
        <form action={startTrip.bind(null, "surprise")} className="mt-4">
          <button type="submit" className="inline-flex rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
            Start Surprise
          </button>
        </form>
      </Card>
    </div>
  );
}
