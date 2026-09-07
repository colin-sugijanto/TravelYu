import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { setUserPlan } from "@/lib/credits";
import type { PlanTier } from "@/types/domain";

/**
 * PATCH /api/admin/users/[id]/plan — admin override for plan tier.
 * Body: { tier: "free" | "member" | "pro" }
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(appUser.role)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { tier?: string };
  try {
    body = (await request.json()) as { tier?: string };
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const tier = body.tier as PlanTier;
  if (tier !== "free" && tier !== "member" && tier !== "pro") {
    return Response.json({ error: "Invalid tier" }, { status: 400 });
  }

  try {
    const result = await setUserPlan(id, tier);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
