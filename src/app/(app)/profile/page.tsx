import Link from "next/link";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { PassportStats } from "@/components/profile/passport-stats";
import { getCurrentAppUser } from "@/lib/auth";
import { getCreditState } from "@/lib/credits";
import { getProfile } from "@/lib/data";
import { getPlanConfig } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

async function updateProfile(formData: FormData) {
  "use server";

  const fullName = String(formData.get("fullName") ?? "").trim();
  const whatsappNumber = String(formData.get("whatsappNumber") ?? "").trim();
  const vibe = String(formData.get("vibe") ?? "").trim();
  const budgetTier = String(formData.get("budgetTier") ?? "").trim();

  const appUser = await getCurrentAppUser();
  if (!appUser) return;

  const vibes = vibe
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  await supabaseAdmin
    .from("users")
    .update({
      full_name: fullName || null,
      whatsapp_number: whatsappNumber || null,
      travel_preferences: {
        vibe: vibes,
        budget_tier: budgetTier || undefined,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", appUser.id);

  revalidateTag(`user:${appUser.id}:profile`, "max");
}

export default async function ProfilePage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect("/login?next=%2Fprofile");
  }

  const [profile, creditState] = await Promise.all([getProfile(appUser.id), getCreditState(appUser.id)]);
  const planConfig = getPlanConfig(creditState.planTier);
  const initialVibe = Array.isArray(profile.travel_preferences?.vibe) ? profile.travel_preferences?.vibe.join(", ") : "";
  const initialBudgetTier = profile.travel_preferences?.budget_tier ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
        ← Kembali ke dashboard
      </Link>
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Paket & Kredit AI</CardTitle>
          <CardText className="mt-1">
            {planConfig.name} · ⚡ {creditState.balance}/{creditState.quota} kredit (periode {creditState.period})
          </CardText>
        </div>
        <Link href="/plans" className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white">
          Kelola Paket
        </Link>
      </div>
    </Card>

    <PassportStats userId={appUser.id} />

    <Card className="p-5">
      <CardTitle>Profil Saya</CardTitle>
      <CardText className="mt-1">Kelola data onboarding: nama, WA, dan preferensi perjalanan.</CardText>

      <form action={updateProfile} className="mt-4 space-y-3">
        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium">Nama Lengkap</label>
          <input id="profile-name" name="fullName" defaultValue={profile.full_name ?? ""} autoComplete="name" className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm outline-none focus:border-orange-400" />
        </div>

        <div>
          <label htmlFor="profile-wa" className="block text-sm font-medium">Nomor WhatsApp</label>
          <input id="profile-wa" name="whatsappNumber" defaultValue={profile.whatsapp_number ?? ""} inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" pattern="(\+?62|0)8[0-9\s-]{7,14}" title="Contoh: 081234567890" className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm outline-none focus:border-orange-400" />
          <p className="mt-1 text-[11px] text-zinc-400">Dipakai untuk notifikasi itinerary via WhatsApp.</p>
        </div>

        <div>
          <label htmlFor="profile-vibe" className="block text-sm font-medium">Preferensi Vibe (pisahkan dengan koma)</label>
          <input id="profile-vibe" name="vibe" defaultValue={initialVibe} placeholder="budaya, petualangan, kuliner" className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm outline-none focus:border-orange-400" />
        </div>

        <div>
          <label htmlFor="profile-budget" className="block text-sm font-medium">Tingkat Anggaran</label>
          <input id="profile-budget" name="budgetTier" defaultValue={initialBudgetTier} placeholder="hemat / menengah / premium" list="budget-tiers" className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm outline-none focus:border-orange-400" />
          <datalist id="budget-tiers">
            <option value="hemat" />
            <option value="menengah" />
            <option value="premium" />
          </datalist>
        </div>

        <div className="rounded-lg bg-[var(--bg-alt)] px-3 py-2 text-sm">
          Peran: <span className="font-semibold">{profile.role}</span> · Poin: <span className="font-semibold">{profile.points_balance}</span>
        </div>

        <button type="submit" className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
          Simpan Profil
        </button>
      </form>
    </Card>
    </div>
  );
}
