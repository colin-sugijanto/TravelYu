import { Card, CardText, CardTitle } from "@/components/ui/card";

const logs = [
  { to: "user:trip_01", message: "Itinerary ready", status: "sent" },
  { to: "vendor:ubud_green", message: "Need availability confirmation", status: "delivered" },
  { to: "admin:oncall", message: "New flagged item", status: "queued" },
];

export default function AdminWhatsappPage() {
  return (
    <Card className="p-5">
      <CardTitle>WhatsApp Center</CardTitle>
      <CardText className="mt-1">Audit log outgoing/incoming WA messages dari WAHA/Evolution automation.</CardText>

      <div className="mt-3 space-y-2">
        {logs.map((entry, idx) => (
          <div key={`${entry.to}-${idx}`} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{entry.to}</span>
              <span className="text-[var(--text-soft)]">{entry.status}</span>
            </div>
            <p className="text-xs text-[var(--text-soft)]">{entry.message}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
