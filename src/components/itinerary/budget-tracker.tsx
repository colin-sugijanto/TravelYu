import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatIdr } from "@/lib/utils";
import type { ItineraryItem } from "@/types/domain";

interface BudgetTrackerProps {
  totalBudgetIdr: number;
  items: ItineraryItem[];
}

const categoryMap: Record<ItineraryItem["activity_type"], string> = {
  accommodation: "Akomodasi",
  transport: "Transport",
  dining: "Makan",
  attraction: "Aktivitas",
  experience: "Experience",
  rest: "Lainnya",
};

export function BudgetTracker({ totalBudgetIdr, items }: BudgetTrackerProps) {
  if (items.length === 0) {
    return (
      <Card className="p-5">
        <CardTitle>Budget Tracker</CardTitle>
        <CardText className="mt-2">
          Budget akan muncul setelah itinerary berhasil digenerate.
        </CardText>
      </Card>
    );
  }

  const spent = items.reduce((sum, item) => sum + item.est_cost_idr, 0);
  const left = Math.max(0, totalBudgetIdr - spent);
  const usedPercent = totalBudgetIdr
    ? Math.round((spent / totalBudgetIdr) * 100)
    : 0;

  const byCategory = items.reduce<Record<string, number>>((acc, item) => {
    const key = categoryMap[item.activity_type];
    acc[key] = (acc[key] ?? 0) + item.est_cost_idr;
    return acc;
  }, {});

  return (
    <Card className="p-5">
      <CardTitle>Budget Tracker</CardTitle>
      <div className="mt-3 rounded-xl bg-(--bg-alt) p-3">
        <div className="flex items-center justify-between text-sm">
          <span>Total Budget</span>
          <span className="font-semibold">{formatIdr(totalBudgetIdr)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span>Remaining</span>
          <span className="font-semibold text-(--brand-strong)">
            {formatIdr(left)}
          </span>
        </div>
        <Progress className="mt-3" value={usedPercent} />
        <CardText className="mt-2 text-xs">
          Used {usedPercent}% dari budget trip
        </CardText>
      </div>

      <div className="mt-3 space-y-2">
        {Object.entries(byCategory).map(([category, value]) => (
          <div
            key={category}
            className="flex items-center justify-between rounded-lg border border-(--border) bg-white px-3 py-2 text-sm"
          >
            <span>{category}</span>
            <span className="font-medium">{formatIdr(value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
