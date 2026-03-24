import { PackingList } from "@/components/packing/packing-list";
import { getPackingList } from "@/lib/data";

export default async function TripPackingPage() {
  const items = await getPackingList();
  return <PackingList initialItems={items} />;
}
