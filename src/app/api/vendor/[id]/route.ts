import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("tripId") ?? "";

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id || id === "undefined" || id === "null") {
    return Response.json({ error: "Invalid vendor ID" }, { status: 400 });
  }

  if (!tripId) {
    return Response.json({ error: "tripId is required" }, { status: 400 });
  }

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(tripId, "id,user_id");
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: tripVendor } = await supabaseAdmin
    .from("itinerary_items")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("vendor_id", id)
    .limit(1)
    .maybeSingle();

  if (!tripVendor) {
    return Response.json({ error: "Vendor not found for this trip" }, { status: 404 });
  }

  try {
    const { data: vendor } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!vendor) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }

    return Response.json({ vendor });
  } catch {
    return Response.json({ error: "Failed to fetch vendor" }, { status: 500 });
  }
}
