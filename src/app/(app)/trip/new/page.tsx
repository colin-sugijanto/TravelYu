import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Compass, Sparkles, Ticket } from "lucide-react";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { ImportTicketCard } from "@/components/vault/import-ticket-card";
import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function createTrip(mode: "standard" | "surprise") {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    return null;
  }

  const { checkTripCreationAllowed } = await import("@/lib/entitlements");
  const gate = await checkTripCreationAllowed(appUser.id);
  if (!gate.ok) {
    return "PLAN_LIMIT" as const;
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
  if (tripId === "PLAN_LIMIT") {
    redirect("/plans?reason=trip-limit");
  }
  if (!tripId) {
    redirect(`/login?next=${encodeURIComponent(`/trip/new?mode=${mode}`)}`);
  }

  const urlMode = mode === "surprise" ? "surprise" : "standard";
  redirect(`/trip/new/intake?mode=${urlMode}&tripId=${encodeURIComponent(tripId)}`);
}

export default function NewTripPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Dashboard
        </Link>
        <ol className="flex items-center gap-1.5 text-[11px] font-bold" aria-label="Langkah pembuatan trip">
          <li className="rounded-full bg-zinc-900 px-2.5 py-1 text-white">1 · Pilih Mode</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">2 · Intake</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">3 · Opsi</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">4 · Itinerary</li>
        </ol>
      </div>

      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Mulai trip baru — pilih cara favoritmu</h1>
        <p className="mt-1 text-sm text-[var(--text-soft)]">Biaya AI transparan: intake 1/pesan · komparasi 6 · generate itinerary 25. Tidak ada trip duplikat sampai kamu lanjut intake.</p>
      </div>

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
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(249,115,22,0.65)] transition hover:bg-[var(--brand-strong)]"
            >
              Mulai Standard →
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
              className="inline-flex w-full items-center justify-center rounded-full border border-[var(--brand-strong)] bg-[var(--brand-strong)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_-18px_rgba(249,115,22,0.8)] transition hover:translate-y-[-1px] hover:bg-[#c2470f]"
            >
              Coba Surprise Me →
            </button>
          </form>
        </Card>
      </div>

      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-semibold text-teal-700">
          <Ticket className="h-3.5 w-3.5" />
          Punya tiket asli? Mulai dari sana
        </div>
        <CardTitle className="mt-3">Import Tiket → Trip Otomatis</CardTitle>
        <CardText className="mt-2">
          Upload e-ticket pesawat / KAI / hotel — AI buatkan trip di sekitar tiketmu. Tiket jadi patokan (🔒 anchor), bukan sekadar arsip.
        </CardText>
        <div className="mt-4">
          <ImportTicketCard compact />
        </div>
      </Card>
    </div>
  );
}
