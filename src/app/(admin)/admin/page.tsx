import Link from "next/link";

import { AdminFlagQueue } from "@/components/admin/flag-queue";
import { Card, CardText, CardTitle } from "@/components/ui/card";

const cards = [
  { title: "Trip Queue", value: "26 active", href: "/admin/trips" },
  { title: "Flagged Items", value: "4 urgent", href: "/admin/flagged" },
  { title: "Live Chat", value: "2 open", href: "/admin/chat" },
  { title: "WhatsApp Center", value: "134 messages", href: "/admin/whatsapp" },
];

export default function AdminHomePage() {
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
          <AdminFlagQueue />
        </div>
      </Card>
    </div>
  );
}
