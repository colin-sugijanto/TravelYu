import { getCurrentAppUser } from "@/lib/auth";
import { scheduleAwardPoints } from "@/lib/points";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";
import type { IntakeData, TripStatus } from "@/types/domain";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REVIEWABLE_ITEM_PREFIX = "itinerary-item:";

type VendorType = "hotel" | "villa" | "restaurant" | "attraction" | "transport" | "experience" | "guide";

function toVendorTypeFromActivity(activityType: string): VendorType {
  switch (activityType) {
    case "accommodation":
      return "hotel";
    case "dining":
      return "restaurant";
    case "transport":
      return "transport";
    case "experience":
      return "experience";
    case "attraction":
      return "attraction";
    default:
      return "guide";
  }
}

function pickTripCity(intakeData: unknown) {
  if (!intakeData || typeof intakeData !== "object") return "Indonesia";
  const where = (intakeData as { where?: unknown }).where;
  if (typeof where !== "string") return "Indonesia";
  const city = where.split(",")[0]?.trim();
  return city && city.length > 0 ? city : "Indonesia";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string; intake_data: IntakeData | null }>(
    id,
    "id,user_id,intake_data",
  );

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  const isOwner = trip.user_id === appUser.id;
  if (!isOwner) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: items } = await supabaseAdmin
    .from("itinerary_items")
    .select("id,vendor_id,title,activity_type")
    .eq("trip_id", trip.id)
    .order("day_number", { ascending: true })
    .order("sort_order", { ascending: true });

  const vendorIds = [...new Set((items ?? []).map((item) => item.vendor_id).filter(Boolean))] as string[];

  const { data: vendors } =
    vendorIds.length > 0
      ? await supabaseAdmin
          .from("vendors")
          .select("id,name,type,city")
          .in("id", vendorIds)
          .order("name", { ascending: true })
      : { data: [] as Array<{ id: string; name: string; type: string; city: string }> };

  const { data: existingReviews } = await supabaseAdmin
    .from("vendor_reviews")
    .select("vendor_id,rating,comment")
    .eq("trip_id", trip.id)
    .eq("user_id", appUser.id);

  const reviewMap = new Map((existingReviews ?? []).map((review) => [review.vendor_id, review]));

  const tripCity = pickTripCity(trip.intake_data);

  const inferredByTitle = new Set<string>();
  const inferredVendors = (items ?? [])
    .filter((item) => !item.vendor_id)
    .filter((item) => {
      const key = `${item.title.trim().toLowerCase()}::${item.activity_type}`;
      if (!item.title.trim()) return false;
      if (inferredByTitle.has(key)) return false;
      inferredByTitle.add(key);
      return true;
    })
    .map((item) => ({
      id: `${REVIEWABLE_ITEM_PREFIX}${item.id}`,
      name: item.title,
      type: item.activity_type,
      city: tripCity,
      review: null,
    }));

  const persistedVendors = (vendors ?? []).map((vendor) => ({
    ...vendor,
    review: reviewMap.get(vendor.id) ?? null,
  }));

  const allVendors = [...persistedVendors, ...inferredVendors].sort((a, b) =>
    a.name.localeCompare(b.name, "id"),
  );

  return Response.json({ tripId: trip.id, vendors: allVendors });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    vendorId?: string;
    rating?: number;
    comment?: string;
  };

  if (!body.vendorId || typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{
    id: string;
    user_id: string;
    status: TripStatus;
    intake_data: IntakeData | null;
  }>(id, "id,user_id,status,intake_data");
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id) {
    return Response.json({ error: "Only trip owner can submit reviews" }, { status: 403 });
  }

  if (trip.status !== "completed") {
    return Response.json({ error: "Reviews can be submitted only for completed trips" }, { status: 400 });
  }

  let resolvedVendorId = body.vendorId;

  if (body.vendorId.startsWith(REVIEWABLE_ITEM_PREFIX)) {
    const itemId = body.vendorId.slice(REVIEWABLE_ITEM_PREFIX.length);
    if (!UUID_RE.test(itemId)) {
      return Response.json({ error: "Invalid vendor reference" }, { status: 400 });
    }

    const { data: item } = await supabaseAdmin
      .from("itinerary_items")
      .select("id,trip_id,vendor_id,title,activity_type")
      .eq("id", itemId)
      .eq("trip_id", trip.id)
      .maybeSingle();

    if (!item) {
      return Response.json({ error: "Itinerary item not found" }, { status: 404 });
    }

    if (item.vendor_id) {
      resolvedVendorId = item.vendor_id;
    } else {
      const city = pickTripCity(trip.intake_data);
      const vendorType = toVendorTypeFromActivity(item.activity_type);

      const { data: matchedVendor } = await supabaseAdmin
        .from("vendors")
        .select("id")
        .eq("name", item.title)
        .eq("city", city)
        .maybeSingle();

      let vendorIdToUse = matchedVendor?.id ?? null;
      if (!vendorIdToUse) {
        const { data: insertedVendor, error: insertVendorError } = await supabaseAdmin
          .from("vendors")
          .insert({
            name: item.title,
            type: vendorType,
            city,
            province: city,
            price_tier: "mid",
            is_verified: false,
          })
          .select("id")
          .single();

        if (insertVendorError || !insertedVendor?.id) {
          return Response.json({ error: "Failed to prepare vendor review" }, { status: 500 });
        }
        vendorIdToUse = insertedVendor.id;
      }

      await supabaseAdmin
        .from("itinerary_items")
        .update({ vendor_id: vendorIdToUse, updated_at: new Date().toISOString() })
        .eq("id", item.id);

      resolvedVendorId = vendorIdToUse;
    }
  }

  if (!UUID_RE.test(resolvedVendorId)) {
    return Response.json({ error: "Invalid vendor ID" }, { status: 400 });
  }

  const { data: tripVendorItem } = await supabaseAdmin
    .from("itinerary_items")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("vendor_id", resolvedVendorId)
    .maybeSingle();

  if (!tripVendorItem) {
    return Response.json({ error: "Vendor tidak ditemukan pada itinerary trip ini" }, { status: 400 });
  }

  // Check if this is the first review for this vendor/trip (to award points only once)
  const { data: existingReview } = await supabaseAdmin
    .from("vendor_reviews")
    .select("id")
    .eq("vendor_id", resolvedVendorId)
    .eq("trip_id", trip.id)
    .eq("user_id", appUser.id)
    .maybeSingle();

  const isFirstReview = !existingReview;

  const { error } = await supabaseAdmin.from("vendor_reviews").upsert(
    {
      vendor_id: resolvedVendorId,
      trip_id: trip.id,
      user_id: appUser.id,
      rating: body.rating,
      comment: body.comment?.trim() || null,
      is_public: true,
    },
    { onConflict: "vendor_id,user_id,trip_id" },
  );

  if (error) {
    return Response.json({ error: "Failed to save review" }, { status: 500 });
  }

  // Award 50 points for first review of this vendor on this trip
  if (isFirstReview) {
    scheduleAwardPoints(appUser.id, 50, "vendor_review", `${trip.id}:${resolvedVendorId}`);

    const recipient = await resolveTripRecipient(trip.id as string);
    if (recipient) {
      scheduleNotification({
        eventType: "points_earned",
        tripId: trip.id as string,
        userName: recipient.userName,
        email: recipient.email,
        phoneE164: recipient.phoneE164,
        channelPreference: "both",
        subject: "+50 poin dari ulasan vendor",
        emailText:
          "Terima kasih sudah mengirim ulasan vendor. Kamu mendapatkan +50 poin loyalty dari TravelYu.",
        waText: "Makasih! Kamu baru saja dapat +50 poin loyalty dari ulasan vendor di TravelYu.",
      });
    }
  }

  return Response.json({ ok: true, pointsAwarded: isFirstReview ? 50 : 0 });
}
