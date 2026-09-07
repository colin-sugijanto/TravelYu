import { revalidateTag } from "next/cache";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier } from "@/lib/trip-access";
import type { TripStatus } from "@/types/domain";

/**
 * PATCH /api/trip/[id]/activate — mark an approved trip as active (user is departing).
 * Allowed only by the trip owner when status is 'approved'.
 */
export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string; status: TripStatus }>(
    id,
    "id,user_id,status",
  );

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id && !isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (trip.status === "active") {
    return Response.json({ ok: true, unchanged: true });
  }

  if (trip.status !== "approved") {
    return Response.json(
      { error: "Trip harus berstatus approved untuk diaktifkan." },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from("trips")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", trip.id);

  if (error) {
    return Response.json({ error: "Failed to activate trip" }, { status: 500 });
  }

  revalidateTag(`trip:${trip.id}`, "max");
  revalidateTag("admin:metrics", "max");

  return Response.json({ ok: true });
}
