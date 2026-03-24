import { Card, CardText, CardTitle } from "@/components/ui/card";

export default function ReferralPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <CardTitle>Referral Program</CardTitle>
        <CardText className="mt-2">Dapatkan 25 poin untuk setiap referral signup yang valid.</CardText>
        <div className="mt-3 rounded-lg bg-[var(--bg-alt)] p-3 text-sm">Kode referral kamu: TRAVELYU-RAMA-26</div>
      </Card>

      <Card className="p-5">
        <CardTitle>Redeem Rules</CardTitle>
        <ul className="mt-2 list-disc pl-5 text-sm text-[var(--text-soft)]">
          <li>500 poin = diskon IDR 50.000</li>
          <li>1000 poin = free planning fee</li>
          <li>Wanderer tier dapat priority CS + early deals</li>
        </ul>
      </Card>
    </div>
  );
}
