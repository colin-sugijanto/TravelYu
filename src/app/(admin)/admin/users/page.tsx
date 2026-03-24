import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getProfile } from "@/lib/data";

export default async function AdminUsersPage() {
  const profile = await getProfile();

  return (
    <Card className="p-5">
      <CardTitle>User Management</CardTitle>
      <CardText className="mt-1">Role management traveler/admin/super_admin.</CardText>

      <div className="mt-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{profile.full_name}</span>
          <span className="text-[var(--text-soft)]">{profile.role}</span>
        </div>
        <p className="text-xs text-[var(--text-soft)]">{profile.whatsapp_number}</p>
      </div>
    </Card>
  );
}
