import { Badge } from "@/components/ui/badge";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";
import type { ItineraryItem } from "@/types/domain";

interface TimelineProps {
  items: ItineraryItem[];
}

export function ItineraryTimeline({ items }: TimelineProps) {
  const grouped = items.reduce<Record<number, ItineraryItem[]>>((acc, item) => {
    if (!acc[item.day_number]) acc[item.day_number] = [];
    acc[item.day_number].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([day, dayItems]) => (
        <Card key={day} className="p-4">
          <CardTitle>Day {day}</CardTitle>
          <div className="mt-3 space-y-3">
            {dayItems
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <Badge tone={item.status === "booked_locked" ? "danger" : "brand"}>{item.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <CardText className="mt-1">{item.description}</CardText>
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-soft)]">
                    <span>
                      {item.time_slot} · {item.activity_type}
                    </span>
                    <span>{formatIdr(item.est_cost_idr)}</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
