import { AdminFlagQueue } from "@/components/admin/flag-queue";
import { getFlaggedQueue } from "@/lib/data";

export default async function AdminFlaggedPage() {
  const items = await getFlaggedQueue();
  return <AdminFlagQueue items={items} />;
}
