import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { formatIdr } from "@/lib/utils";
import { RedeemPointsButton } from "@/components/loyalty/redeem-points-button";
import { redirect } from "next/navigation";

function rewardFromPoints(points: number) {
  if (points >= 1000) return "Free planning fee tersedia";
  if (points >= 500) return `Berhak atas diskon planning fee ${formatIdr(50000)}`;
  return `${500 - points} poin lagi untuk diskon ${formatIdr(50000)}`;
}

export default async function ReferralPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect("/login?next=%2Freferral");
  }

  const profile = await getProfile(appUser.id);
  const referralCode = `TRAVELYU-${(profile.full_name ?? "traveler").replace(/\s+/g, "-").toUpperCase()}`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <CardTitle>Program Referral</CardTitle>
        <CardText className="mt-2">Dapatkan 25 poin untuk setiap referral signup yang valid.</CardText>
        <div className="mt-3 rounded-lg bg-[var(--bg-alt)] p-3 text-sm">Kode referral kamu: {referralCode}</div>
      </Card>

      <Card className="p-5">
        <CardTitle>Aturan Penukaran</CardTitle>
        <ul className="mt-2 list-disc pl-5 text-sm text-[var(--text-soft)]">
          <li>500 poin = diskon IDR 50.000</li>
          <li>1000 poin = free planning fee</li>
          <li>Wanderer tier dapat priority CS + early deals</li>
        </ul>
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
          Status kamu: <span className="font-semibold">{profile.loyalty_tier}</span> · {rewardFromPoints(profile.points_balance)}
        </div>

        <div className="mt-3">
          <RedeemPointsButton points={profile.points_balance} />
        </div>
      </Card>
    </div>
  );
}
