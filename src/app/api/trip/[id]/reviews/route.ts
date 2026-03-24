import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabase.from("trips").select("id,user_id").or(`id.eq.${id},public_id.eq.${id}`).maybeSingle();

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  const isOwner = trip.user_id === user.id;
  if (!isOwner) {
    const { data: member } = await supabase
      .from("group_trip_members")
      .select("trip_id")
      .eq("trip_id", trip.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: items } = await supabase
    .from("itinerary_items")
    .select("vendor_id")
    .eq("trip_id", trip.id)
    .not("vendor_id", "is", null);

  const vendorIds = [...new Set((items ?? []).map((item) => item.vendor_id).filter(Boolean))] as string[];
  if (vendorIds.length === 0) {
    return Response.json({ tripId: trip.id, vendors: [] });
  }

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id,name,type,city")
    .in("id", vendorIds)
    .order("name", { ascending: true });

  const { data: existingReviews } = await supabase
    .from("vendor_reviews")
    .select("vendor_id,rating,comment")
    .eq("trip_id", trip.id)
    .eq("user_id", user.id);

  const reviewMap = new Map((existingReviews ?? []).map((review) => [review.vendor_id, review]));

  return Response.json({
    tripId: trip.id,
    vendors: (vendors ?? []).map((vendor) => ({
      ...vendor,
      review: reviewMap.get(vendor.id) ?? null,
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    vendorId?: string;
    rating?: number;
    comment?: string;
  };

  if (!body.vendorId || !body.rating || body.rating < 1 || body.rating > 5) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabase.from("trips").select("id,user_id,status").or(`id.eq.${id},public_id.eq.${id}`).maybeSingle();
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return Response.json({ error: "Only trip owner can submit reviews" }, { status: 403 });
  }

  if (trip.status !== "completed") {
    return Response.json({ error: "Reviews can be submitted only for completed trips" }, { status: 400 });
  }

  const { error } = await supabase.from("vendor_reviews").upsert(
    {
      vendor_id: body.vendorId,
      trip_id: trip.id,
      user_id: user.id,
      rating: body.rating,
      comment: body.comment?.trim() || null,
      is_public: true,
    },
    { onConflict: "vendor_id,user_id,trip_id" },
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
