import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

interface PointsWidgetProps {
  points: number;
  tier: "explorer" | "adventurer" | "wanderer";
}

const targetByTier = {
  explorer: 500,
  adventurer: 2000,
  wanderer: 3000,
};

export function PointsWidget({ points, tier }: PointsWidgetProps) {
  const target = targetByTier[tier];
  const progress = Math.min(100, Math.round((points / target) * 100));

  return (
    <Card className="p-8 border-transparent shadow-md bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-[var(--accent-sky)] opacity-10 rounded-full blur-2xl"></div>
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          Poin Loyalitas <Sparkles className="w-5 h-5 text-[var(--sun)]" />
        </CardTitle>
        <span className="px-3 py-1 rounded-full bg-blue-50 text-[var(--brand-blue-strong)] text-xs font-bold uppercase tracking-wider">
          {tier}
        </span>
      </div>
      
      <div className="relative z-10">
        <p className="text-5xl font-extrabold tracking-tighter text-[var(--text)] mb-6">
          {points.toLocaleString()} <span className="text-xl text-[var(--text-soft)] font-semibold tracking-normal">pts</span>
        </p>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-[var(--text-soft)]">
            <span>Progres ke reward berikutnya</span>
            <span>{progress}%</span>
          </div>
          <Progress className="h-2.5" value={progress} />
        </div>
      </div>
    </Card>
  );
}
