import { setUserPlan } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlanTier } from "@/types/domain";

/**
 * POST /api/subscriptions/webhook — DOKU / payment gateway callback.
 * Expected (MVP contract): { invoiceNo, status: "paid" | "failed", token: string }
 * Requires TRAVELYU_INTERNAL_API_TOKEN to be configured; requests without a
 * matching token are rejected so strangers cannot self-activate paid plans.
 */
export async function POST(request: Request) {
  let body: { invoiceNo?: string; status?: string; token?: string };
  try {
    body = (await request.json()) as { invoiceNo?: string; status?: string; token?: string };
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const expectedToken = process.env.TRAVELYU_INTERNAL_API_TOKEN;
  if (!expectedToken) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (body.token !== expectedToken) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const invoiceNo = String(body.invoiceNo ?? "").trim();
  if (!invoiceNo) return Response.json({ error: "invoiceNo required" }, { status: 400 });
  if (body.status !== "paid") {
    return Response.json({ ok: true, ignored: true });
  }

  try {
    const { data: sub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id,user_id,tier,billing_cycle")
      .eq("doku_invoice_no", invoiceNo)
      .maybeSingle();

    if (!sub) return Response.json({ error: "Subscription not found" }, { status: 404 });

    const tier = (sub as { tier: PlanTier }).tier;
    const userId = (sub as { user_id: string }).user_id;
    const billingCycle = (sub as { billing_cycle: "monthly" | "yearly" }).billing_cycle ?? "monthly";

    const expiresAt = new Date();
    if (billingCycle === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    else expiresAt.setMonth(expiresAt.getMonth() + 1);

    await supabaseAdmin
      .from("user_subscriptions")
      .update({ status: "active", started_at: new Date().toISOString(), expires_at: expiresAt.toISOString() })
      .eq("doku_invoice_no", invoiceNo);

    await setUserPlan(userId, tier, { expiresAt: expiresAt.toISOString(), billingCycle, invoiceNo });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Webhook failed" }, { status: 500 });
  }
}
