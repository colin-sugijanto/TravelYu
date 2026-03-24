import { Badge } from "@/components/ui/badge";
import { Card, CardText, CardTitle } from "@/components/ui/card";

interface FlagItem {
  id: string;
  trip: string;
  reason: string;
  priority: "high" | "medium";
  requestedAt: string;
}

const flags: FlagItem[] = [
  { id: "fq1", trip: "Bali Family Escape", reason: "Hotel swap within 24h", priority: "high", requestedAt: "2026-03-24 08:20" },
  { id: "fq2", trip: "Lombok Surprise", reason: "Vendor replacement after booking", priority: "medium", requestedAt: "2026-03-24 09:10" },
];

export function AdminFlagQueue() {
  return (
    <Card className="p-5">
      <CardTitle>Flagged Items</CardTitle>
      <div className="mt-3 space-y-2">
        {flags.map((item) => (
          <div key={item.id} className="rounded-xl border border-[var(--border)] bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{item.trip}</p>
              <Badge tone={item.priority === "high" ? "danger" : "sun"}>{item.priority}</Badge>
            </div>
            <CardText className="mt-1">{item.reason}</CardText>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Requested at {item.requestedAt}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
