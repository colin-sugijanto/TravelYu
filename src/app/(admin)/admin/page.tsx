import Link from "next/link";

import { AdminFlagQueue } from "@/components/admin/flag-queue";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getAdminMetrics, getFlaggedQueue } from "@/lib/data";
import { formatIdr } from "@/lib/utils";

export default async function AdminHomePage() {
  const [metrics, flaggedItems] = await Promise.all([getAdminMetrics(), getFlaggedQueue(8)]);

  const cards = [
    { title: "Trip Queue (30d)", value: `${metrics.tripVolume30d} trips`, href: "/admin/trips" },
    { title: "Flagged Items", value: `${metrics.flaggedPending} pending`, href: "/admin/flagged" },
    { title: "Live Chat", value: `${metrics.openChats} open`, href: "/admin/chat" },
    { title: "Revenue", value: formatIdr(metrics.revenuePlanningFeeIdr), href: "/admin/analytics" },
  ];

  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <Link key={item.title} href={item.href}>
            <Card className="p-4 transition hover:translate-y-[-2px]">
              <CardText>{item.title}</CardText>
              <CardTitle className="mt-1 text-xl">{item.value}</CardTitle>
            </Card>
          </Link>
        ))}
      </section>

      <Card className="p-5">
        <CardTitle>CS Priorities</CardTitle>
        <div className="mt-3">
          <AdminFlagQueue items={flaggedItems} compact />
        </div>
      </Card>
    </div>
  );
}
