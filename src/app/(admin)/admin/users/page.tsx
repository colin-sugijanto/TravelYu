import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getUsers } from "@/lib/data";

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <Card className="p-5">
      <CardTitle>User Management</CardTitle>
      <CardText className="mt-1">Role management traveler/admin/super_admin.</CardText>

      <div className="mt-3 space-y-2">
        {users.map((profile) => (
          <div key={profile.id} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{profile.full_name ?? profile.id.slice(0, 8)}</span>
              <span className="text-[var(--text-soft)]">{profile.role}</span>
            </div>
            <p className="text-xs text-[var(--text-soft)]">{profile.whatsapp_number ?? "No WhatsApp number"}</p>
          </div>
        ))}

        {users.length === 0 ? <CardText>Belum ada user terdaftar.</CardText> : null}
      </div>
    </Card>
  );
}
