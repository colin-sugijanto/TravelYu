import { redirect } from "next/navigation";

import { PackingList } from "@/components/packing/packing-list";
import { getOrGeneratePackingList } from "@/lib/data";
import { getCurrentAppUser } from "@/lib/auth";

export default async function TripPackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect(`/login?next=/trip/${id}/packing`);

  const items = await getOrGeneratePackingList(id);
  return <PackingList initialItems={items} />;
}
