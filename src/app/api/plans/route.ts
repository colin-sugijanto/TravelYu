import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plans";

/** GET /api/plans — public pricing catalog (no auth required). */
export async function GET() {
  return Response.json({
    plans: PLAN_ORDER.map((tier) => PLAN_CONFIGS[tier]),
  });
}
