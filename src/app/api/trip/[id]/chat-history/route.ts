import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

type StoredMessage = {
  id: string;
  role: string;
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
};

const VALID_TYPES = new Set(["editor", "intake"]);

function storageKey(type: string) {
  return `_${type}Chat`;
}

async function resolveAccessibleTrip(tripId: string, userId: string) {
  const { data: trip } = await findTripByIdentifier<{
    id: string;
    user_id: string;
    intake_data: Record<string, unknown> | null;
  }>(tripId, "id,user_id,intake_data");

  if (!trip) return null;
  if (trip.user_id === userId) return trip;

  const member = await isTripMember(trip.id, userId);
  return member ? trip : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "editor";
  if (!VALID_TYPES.has(type)) {
    return Response.json({ error: "Invalid type" }, { status: 400 });
  }

  const trip = await resolveAccessibleTrip(id, appUser.id);
  if (!trip) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const intakeData = (trip.intake_data ?? {}) as Record<string, unknown>;
  const messages = (intakeData[storageKey(type)] as StoredMessage[] | undefined) ?? [];

  return Response.json({ messages });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    type?: string;
    messages?: StoredMessage[];
  } | null;

  if (!body || !VALID_TYPES.has(body.type ?? "") || !Array.isArray(body.messages)) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const type = body.type!;
  const messages = body.messages.slice(-50);

  const trip = await resolveAccessibleTrip(id, appUser.id);
  if (!trip) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = (trip.intake_data ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existing, [storageKey(type)]: messages };

  const { error } = await supabaseAdmin
    .from("trips")
    .update({ intake_data: merged, updated_at: new Date().toISOString() })
    .eq("id", trip.id);

  if (error) {
    return Response.json({ error: "Failed to save chat history" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
