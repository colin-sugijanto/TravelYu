import { redirect } from "next/navigation";
import { Compass, Sparkles } from "lucide-react";

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
      <Card className="p-5 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          <Compass className="h-3.5 w-3.5" />
          Rekomendasi Presisi
        </div>
        <CardTitle className="mt-3">Standard Mode</CardTitle>
        <CardText className="mt-2">Isi preferensi lengkap termasuk destinasi untuk itinerary yang detail dan terarah.</CardText>
        <form action={startTrip.bind(null, "standard")} className="mt-4">
          <button
            type="submit"
            className="inline-flex rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(249,115,22,0.65)] transition hover:bg-[var(--brand-strong)]"
          >
            Start Standard
          </button>
        </form>
      </Card>

      <Card className="border-[var(--brand)]/45 bg-[linear-gradient(135deg,rgba(249,115,22,0.10),rgba(56,189,248,0.08))] p-5 shadow-[0_28px_44px_-28px_rgba(249,115,22,0.55)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/35 bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--brand-strong)]">
          <Sparkles className="h-3.5 w-3.5" />
          Fast Intake · AI Pilih Destinasi
        </div>
        <CardTitle className="mt-3 text-[var(--brand-strong)]">Surprise Me Mode</CardTitle>
        <CardText className="mt-2 text-[var(--text)]">
          Cukup isi budget, tanggal, dan jumlah peserta. AI akan memilih destinasi Indonesia paling relevan untuk kamu.
        </CardText>
        <form action={startTrip.bind(null, "surprise")} className="mt-4">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full border border-[var(--brand-strong)] bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_28px_-18px_rgba(249,115,22,0.8)] transition hover:translate-y-[-1px] hover:bg-[#c2470f]"
          >
            Surprise Me Sekarang
          </button>
        </form>
      </Card>
    </div>
  );
}
