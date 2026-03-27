import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminFlagQueue } from "@/components/admin/flag-queue";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { getAdminMetrics, getFlaggedQueue } from "@/lib/data";
import { formatIdr } from "@/lib/utils";

export default async function AdminHomePage() {
  const appUser = await getCurrentAppUser();
  if (!appUser || !isAdminRole(appUser.role)) {
    redirect("/dashboard");
  }

  const [metrics, flaggedItems] = await Promise.all([getAdminMetrics(appUser.id), getFlaggedQueue(8)]);

  const cards = [
    { title: "Antrian Trip (30h)", value: `${metrics.tripVolume30d} trip`, href: "/admin/trips" },
    { title: "Item Ditandai", value: `${metrics.flaggedPending} menunggu`, href: "/admin/flagged" },
    { title: "Live Chat", value: `${metrics.openChats} aktif`, href: "/admin/chat" },
    { title: "Pendapatan", value: formatIdr(metrics.revenuePlanningFeeIdr), href: "/admin/analytics" },
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
        <CardTitle>Prioritas CS</CardTitle>
        <div className="mt-3">
          <AdminFlagQueue items={flaggedItems} compact />
        </div>
      </Card>
    </div>
  );
}
