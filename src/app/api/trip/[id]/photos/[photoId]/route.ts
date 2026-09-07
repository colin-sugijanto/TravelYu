import { revalidateTag } from "next/cache";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

/**
 * PATCH /api/trip/[id]/photos/[photoId] — link a memory photo to a day / itinerary item.
 * Body: { itinerary_item_id?: string | null, day_number?: number | null, taken_at?: string | null, caption?: string }
 * Powers the scrapbook EXIF auto-sort (client sends EXIF timestamp; server stores it).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

  if (trip.user_id !== appUser.id && !isAdminRole(appUser.role)) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { itinerary_item_id?: string | null; day_number?: number | null; taken_at?: string | null; caption?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.itinerary_item_id !== undefined) patch.itinerary_item_id = body.itinerary_item_id || null;
  if (body.day_number !== undefined) {
    const day = body.day_number;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 60)) {
      return Response.json({ error: "day_number tidak valid." }, { status: 400 });
    }
    patch.day_number = day;
  }
  if (body.taken_at !== undefined) patch.taken_at = body.taken_at || null;
  if (typeof body.caption === "string") patch.caption = body.caption.slice(0, 300) || null;

  if (Object.keys(patch).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

  try {
    const { data, error } = await supabaseAdmin
      .from("trip_photos")
      .update(patch)
      .eq("id", photoId)
      .eq("trip_id", trip.id)
      .select("id,itinerary_item_id,day_number,taken_at,caption")
      .single();
    if (error) throw error;
    revalidateTag(`trip:${trip.id}:photos`, "max");
    return Response.json({ ok: true, photo: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    if (/does not exist|column/i.test(message)) {
      return Response.json({ error: "Kolom scrapbook belum tersedia. Jalankan migrasi 014." }, { status: 500 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
