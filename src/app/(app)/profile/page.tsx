import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getProfile } from "@/lib/data";

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <Card className="max-w-3xl p-5">
      <CardTitle>My Profile</CardTitle>
      <CardText className="mt-1">Kelola data onboarding: nama, WA, dan preferensi perjalanan.</CardText>

      <div className="mt-4 space-y-2 text-sm">
        <p>
          <span className="font-semibold">Name:</span> {profile.full_name}
        </p>
        <p>
          <span className="font-semibold">WhatsApp:</span> {profile.whatsapp_number}
        </p>
        <p>
          <span className="font-semibold">Role:</span> {profile.role}
        </p>
        <p>
          <span className="font-semibold">Points:</span> {profile.points_balance}
        </p>
      </div>
    </Card>
  );
}
