import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
    <Card className="p-5">
      <CardTitle>Loyalty Points</CardTitle>
      <p className="mt-1 text-3xl font-black">{points}</p>
      <CardText className="uppercase tracking-wide">Tier: {tier}</CardText>
      <Progress className="mt-3" value={progress} />
      <CardText className="mt-2 text-xs">Progress to next tier reward</CardText>
    </Card>
  );
}
