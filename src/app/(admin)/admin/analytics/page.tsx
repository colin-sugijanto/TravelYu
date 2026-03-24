import { Card, CardText, CardTitle } from "@/components/ui/card";

const metrics = [
  { label: "Trip Volume (30d)", value: "148" },
  { label: "Revenue Planning Fee", value: "IDR 19.7M" },
  { label: "CS Intervention Rate", value: "18%" },
  { label: "Avg Satisfaction", value: "4.4 / 5" },
];

export default function AdminAnalyticsPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-5">
          <CardText>{metric.label}</CardText>
          <CardTitle className="mt-1 text-2xl">{metric.value}</CardTitle>
        </Card>
      ))}
    </div>
  );
}
