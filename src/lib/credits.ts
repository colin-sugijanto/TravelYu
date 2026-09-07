import { supabaseAdmin } from "@/lib/supabase/admin";
import { AI_CREDIT_COSTS, getPlanConfig } from "@/lib/plans";
import type { CreditState, PlanTier } from "@/types/domain";

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type UserCreditRow = {
  id: string;
  plan_tier: PlanTier;
  ai_credits_balance: number;
  ai_credits_quota: number;
  ai_credits_period: string | null;
  plan_expires_at: string | null;
};

/**
 * Reads credit state. Auto-resets monthly quota when period rolled over.
 * Resilient: returns free-tier defaults when tables/columns are missing.
 */
export async function getCreditState(userId: string): Promise<CreditState> {
  const fallback: CreditState = {
    planTier: "free",
    balance: 30,
    quota: 30,
    period: currentPeriod(),
    expiresAt: null,
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,plan_tier,ai_credits_balance,ai_credits_quota,ai_credits_period,plan_expires_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return fallback;

    const row = data as UserCreditRow;
    const planTier: PlanTier =
      row.plan_tier === "member" || row.plan_tier === "pro" ? row.plan_tier : "free";
    const quota = Number.isFinite(row.ai_credits_quota)
      ? row.ai_credits_quota
      : getPlanConfig(planTier).monthlyCredits;

    // Monthly reset (code-side; RPC also guards this atomically on consume)
    if (row.ai_credits_period !== currentPeriod()) {
      try {
        await supabaseAdmin
          .from("users")
          .update({
            ai_credits_balance: quota,
            ai_credits_period: currentPeriod(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        await supabaseAdmin.from("ai_credit_ledger").insert({
          user_id: userId,
          delta: quota,
          balance_after: quota,
          reason: "monthly_reset",
        });

        return { planTier, balance: quota, quota, period: currentPeriod(), expiresAt: row.plan_expires_at };
      } catch {
        return { planTier, balance: quota, quota, period: currentPeriod(), expiresAt: row.plan_expires_at };
      }
    }

    return {
      planTier,
      balance: Number.isFinite(row.ai_credits_balance) ? row.ai_credits_balance : quota,
      quota,
      period: row.ai_credits_period ?? currentPeriod(),
      expiresAt: row.plan_expires_at,
    };
  } catch {
    return fallback;
  }
}

export function costFor(endpoint: string): number {
  return AI_CREDIT_COSTS[endpoint] ?? 2;
}

type ConsumeResult =
  | { ok: true; balance: number }
  | { ok: false; error: string; balance: number; required: number };

/**
 * Atomically consumes credits via RPC. Returns ok:false when insufficient.
 * Callers should translate that into HTTP 402 + upgrade CTA.
 */
export async function consumeCredits(
  userId: string,
  endpoint: string,
  opts?: { tripId?: string; model?: string; costOverride?: number },
): Promise<ConsumeResult> {
  const required = opts?.costOverride ?? costFor(endpoint);

  try {
    const { data, error } = await supabaseAdmin.rpc("consume_ai_credits", {
      p_user_id: userId,
      p_cost: required,
      p_endpoint: endpoint,
      p_trip_id: opts?.tripId ?? null,
      p_model: opts?.model ?? null,
    });

    if (error) {
      // Table/RPC missing (migration not applied) → fail open so dev isn't blocked
      if (/does not exist|relation|function/i.test(error.message ?? "")) {
        return { ok: true, balance: Number.MAX_SAFE_INTEGER };
      }
      return { ok: false, error: error.message, balance: 0, required };
    }

    const payload = data as { ok: boolean; balance?: number; error?: string } | null;
    if (payload?.ok) return { ok: true, balance: payload.balance ?? 0 };
    return {
      ok: false,
      error: payload?.error ?? "Insufficient credits",
      balance: payload?.balance ?? 0,
      required,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Credit check failed";
    if (/does not exist|relation|function/i.test(message)) {
      return { ok: true, balance: Number.MAX_SAFE_INTEGER };
    }
    return { ok: false, error: message, balance: 0, required };
  }
}

/**
 * Standard gate for AI routes. Returns a 402 Response when credits are insufficient,
 * otherwise null (caller proceeds) — mirrors checkAiRateLimit usage.
 */
export async function requireAiCredits(
  userId: string,
  endpoint: string,
  opts?: { tripId?: string; model?: string; costOverride?: number },
): Promise<Response | null> {
  const result = await consumeCredits(userId, endpoint, opts);
  if (result.ok) return null;

  return Response.json(
    {
      error: "AI credits habis",
      code: "INSUFFICIENT_CREDITS",
      message: `Butuh ${result.required} kredit untuk ${endpoint}, sisa ${result.balance}. Upgrade ke Member/Pro untuk lanjut.`,
      balance: result.balance,
      required: result.required,
      upgradeUrl: "/plans",
    },
    { status: 402 },
  );
}

/** Admin / webhook helper to set a plan + refill quota. */
export async function setUserPlan(
  userId: string,
  tier: PlanTier,
  opts?: { expiresAt?: string | null; billingCycle?: "monthly" | "yearly"; invoiceNo?: string },
) {
  const config = getPlanConfig(tier);
  const period = currentPeriod();

  const { error: userError } = await supabaseAdmin
    .from("users")
    .update({
      plan_tier: tier,
      ai_credits_quota: config.monthlyCredits,
      ai_credits_balance: config.monthlyCredits,
      ai_credits_period: period,
      plan_expires_at: opts?.expiresAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (userError) throw new Error(userError.message);

  try {
    await supabaseAdmin.from("ai_credit_ledger").insert({
      user_id: userId,
      delta: config.monthlyCredits,
      balance_after: config.monthlyCredits,
      reason: `plan_change:${tier}`,
      ref_id: opts?.invoiceNo ?? null,
    });

    await supabaseAdmin.from("user_subscriptions").insert({
      user_id: userId,
      tier,
      status: "active",
      started_at: new Date().toISOString(),
      expires_at: opts?.expiresAt ?? null,
      billing_cycle: opts?.billingCycle ?? "monthly",
      doku_invoice_no: opts?.invoiceNo ?? null,
    });
  } catch {
    // ledger/subscription tables optional in dev — plan update already applied
  }

  return { ok: true, balance: config.monthlyCredits };
}
