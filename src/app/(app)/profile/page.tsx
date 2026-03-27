import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
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

  const profile = await getProfile(appUser.id);
  const initialVibe = Array.isArray(profile.travel_preferences?.vibe) ? profile.travel_preferences?.vibe.join(", ") : "";
  const initialBudgetTier = profile.travel_preferences?.budget_tier ?? "";

  return (
    <Card className="max-w-3xl p-5">
      <CardTitle>Profil Saya</CardTitle>
      <CardText className="mt-1">Kelola data onboarding: nama, WA, dan preferensi perjalanan.</CardText>

      <form action={updateProfile} className="mt-4 space-y-3">
        <label className="block text-sm font-medium">Nama Lengkap</label>
        <input name="fullName" defaultValue={profile.full_name ?? ""} className="h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm" />

        <label className="block text-sm font-medium">Nomor WhatsApp</label>
        <input name="whatsappNumber" defaultValue={profile.whatsapp_number ?? ""} className="h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm" />

        <label className="block text-sm font-medium">Preferensi Vibe (pisahkan dengan koma)</label>
        <input name="vibe" defaultValue={initialVibe} placeholder="budaya, petualangan, kuliner" className="h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm" />

        <label className="block text-sm font-medium">Tingkat Anggaran</label>
        <input name="budgetTier" defaultValue={initialBudgetTier} placeholder="hemat / menengah / premium" className="h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm" />

        <div className="rounded-lg bg-[var(--bg-alt)] px-3 py-2 text-sm">
          Peran: <span className="font-semibold">{profile.role}</span> · Poin: <span className="font-semibold">{profile.points_balance}</span>
        </div>

        <button type="submit" className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
          Simpan Profil
        </button>
      </form>
    </Card>
  );
}
