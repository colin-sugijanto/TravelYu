import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier } from "@/lib/trip-access";

type IntakeProgressBody = {
  who?: string;
  vibe?: string;
  when?: string;
  where?: string;
  budget?: string;
  pacing?: string;
  specialNeeds?: string;
};

/**
 * PATCH /api/trip/[id]/intake-progress
 * Persists partial intake parameters to trips.intake_data during the intake chat.
 * Only updates fields that are present in the body (non-null).
 * Merges with existing intake_data so no previously-detected field is lost.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: IntakeProgressBody;
  try {
    body = (await request.json()) as IntakeProgressBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data: trip } = await findTripByIdentifier<{
    id: string;
    user_id: string;
    intake_data: Record<string, unknown> | null;
  }>(id, "id,user_id,intake_data");

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only updates fields that are explicitly provided (truthy strings)
  const existing = (trip.intake_data ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existing };

  if (body.who?.trim()) merged.who = body.who.trim();
  if (body.vibe?.trim()) merged.vibe = body.vibe.trim();
  if (body.when?.trim()) merged.when = body.when.trim();
  if (body.where?.trim()) merged.where = body.where.trim();
  if (body.budget?.trim()) merged.budget = body.budget.trim();
  if (body.pacing?.trim()) merged.pacing = body.pacing.trim();
  if (body.specialNeeds?.trim()) merged.specialNeeds = body.specialNeeds.trim();

  const { error } = await supabaseAdmin
    .from("trips")
    .update({ intake_data: merged, updated_at: new Date().toISOString() })
    .eq("id", trip.id);

  if (error) {
    return Response.json({ error: "Failed to persist intake progress" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
