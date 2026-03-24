import { redeemPlanningDiscount } from "@/lib/data";

export async function POST() {
  const result = await redeemPlanningDiscount();
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ ok: true, redeemedPoints: result.redeemedPoints });
}
