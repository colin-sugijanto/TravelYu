import Link from "next/link";

import { Card, CardText, CardTitle } from "@/components/ui/card";

export default function NewTripPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5">
        <CardTitle>Standard Mode</CardTitle>
        <CardText className="mt-2">Isi preferensi lengkap via AI chat intake untuk itinerary yang presisi.</CardText>
        <Link href="/trip/new/intake" className="mt-4 inline-flex rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
          Start Standard
        </Link>
      </Card>

      <Card className="p-5">
        <CardTitle>Surprise Me Mode</CardTitle>
        <CardText className="mt-2">Cukup berikan budget + tanggal + pax, biarkan AI pilih destinasi Indonesia terbaik.</CardText>
        <Link href="/trip/new/intake?mode=surprise" className="mt-4 inline-flex rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
          Start Surprise
        </Link>
      </Card>
    </div>
  );
}
