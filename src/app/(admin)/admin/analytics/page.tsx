import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { getAdminMetrics } from "@/lib/data";
import { formatIdr } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function AdminAnalyticsPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser || !isAdminRole(appUser.role)) {
    redirect("/dashboard");
  }

  const metricsData = await getAdminMetrics(appUser.id);

  const metrics = [
    { label: "Trip Volume (30d)", value: `${metricsData.tripVolume30d}` },
    { label: "Planning Fee Baseline", value: formatIdr(metricsData.revenuePlanningFeeIdr) },
    { label: "CS Intervention Rate", value: `${metricsData.csInterventionRate}%` },
    { label: "Avg Satisfaction", value: metricsData.avgSatisfaction ? `${metricsData.avgSatisfaction.toFixed(1)} / 5` : "No data" },
  ];

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
