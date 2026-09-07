import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

/**
 * POST /api/trip/[id]/photos-note — Today Mode "Quick Snap" text note.
 * Appends { text, day, itemId, ts } to trips.intake_data.todayNotes (no storage needed).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string; intake_data: Record<string, unknown> | null }>(
    id,
    "id,user_id,intake_data",
  );
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  if (trip.user_id !== appUser.id) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { caption?: string; day_number?: number; itinerary_item_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const caption = String(body.caption ?? "").trim().slice(0, 300);
  if (!caption) return Response.json({ error: "Caption required" }, { status: 400 });

  try {
    const intake = (trip.intake_data as Record<string, unknown> | null) ?? {};
    const notes = Array.isArray(intake.todayNotes) ? (intake.todayNotes as Array<Record<string, unknown>>) : [];
    notes.push({
      text: caption,
      day: body.day_number ?? null,
      itemId: body.itinerary_item_id ?? null,
      by: appUser.id,
      ts: new Date().toISOString(),
    });

    await supabaseAdmin
      .from("trips")
      .update({ intake_data: { ...intake, todayNotes: notes.slice(-100) }, updated_at: new Date().toISOString() })
      .eq("id", trip.id);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to save note" }, { status: 500 });
  }
}
