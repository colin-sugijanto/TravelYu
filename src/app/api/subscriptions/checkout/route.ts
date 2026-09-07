import { getCurrentAppUser } from "@/lib/auth";
import { getPlanConfig } from "@/lib/plans";
import { setUserPlan } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlanTier } from "@/types/domain";

/**
 * POST /api/subscriptions/checkout — create a subscription checkout.
 * Body: { tier: "member" | "pro", billingCycle: "monthly" | "yearly" }
 *
 * MVP: when DOKU env is absent, activates immediately (dev/mock mode).
 * Production: returns a DOKU hosted checkout URL; activation happens in /webhook.
 */
export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { tier?: string; billingCycle?: string };
  try {
    body = (await request.json()) as { tier?: string; billingCycle?: string };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const tier = body.tier as PlanTier;
  if (tier !== "member" && tier !== "pro") {
    return Response.json({ error: "Tier harus member atau pro." }, { status: 400 });
  }
  const billingCycle = body.billingCycle === "yearly" ? "yearly" : "monthly";
  const config = getPlanConfig(tier);
  const amount = billingCycle === "yearly" ? config.priceYearlyIdr : config.priceMonthlyIdr;

  const invoiceNo = `TYU-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const hasDoku =
    Boolean(process.env.DOKU_CLIENT_ID && process.env.DOKU_SECRET_KEY) ||
    Boolean(process.env.N8N_NOTIFICATION_WEBHOOK_URL);

  // Record pending subscription for reconciliation
  try {
    await supabaseAdmin.from("user_subscriptions").insert({
      user_id: appUser.id,
      tier,
      status: "pending",
      billing_cycle: billingCycle,
      doku_invoice_no: invoiceNo,
    });
  } catch {
    // table optional in dev
  }

  if (!hasDoku) {
    // Dev/mock: activate immediately so the flow is testable end-to-end
    const expiresAt = new Date();
    if (billingCycle === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    else expiresAt.setMonth(expiresAt.getMonth() + 1);

    await setUserPlan(appUser.id, tier, {
      expiresAt: expiresAt.toISOString(),
      billingCycle,
      invoiceNo,
    });

    return Response.json({
      ok: true,
      mode: "mock-activated",
      invoiceNo,
      tier,
      billingCycle,
      amountIdr: amount,
      message: "Paket aktif (mode mock — hubungkan DOKU untuk pembayaran produksi).",
    });
  }

  // Production path: front-end redirects user to DOKU hosted checkout.
  // TODO: call DOKU Checkout API with amount + invoiceNo, then return checkoutUrl.
  // Activation is completed by POST /api/subscriptions/webhook on payment success.
  return Response.json({
    ok: true,
    mode: "doku-pending",
    invoiceNo,
    tier,
    billingCycle,
    amountIdr: amount,
    checkoutUrl: null,
    message: "Invoice dibuat. Selesaikan pembayaran via DOKU; paket aktif otomatis via webhook.",
  });
}
