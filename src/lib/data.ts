import { mockComparisonOptions, mockItineraryItems, mockPackingList, mockProfile, mockTrips } from "@/lib/mock-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tierFromPoints } from "@/lib/utils";
import type {
  CSChatSession,
  ComparisonOption,
  FlaggedQueueItem,
  ItineraryItem,
  Trip,
  TripPhoto,
  UserProfile,
  VendorSummary,
} from "@/types/domain";

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function getProfile(): Promise<UserProfile> {
  if (!hasSupabaseEnv()) return mockProfile;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return mockProfile;

    const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
    if (!data) return { ...mockProfile, id: user.id, full_name: user.user_metadata?.full_name ?? mockProfile.full_name };
    return data as UserProfile;
  } catch {
    return mockProfile;
  }
}

export async function getTrips(): Promise<Trip[]> {
  if (!hasSupabaseEnv()) return mockTrips;

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("trips").select("*").order("created_at", { ascending: false }).limit(20);
    return (data as Trip[]) ?? mockTrips;
  } catch {
    return mockTrips;
  }
}

export async function getTripById(tripId: string): Promise<Trip | null> {
  if (!hasSupabaseEnv()) {
    return mockTrips.find((trip) => trip.id === tripId || trip.public_id === tripId) ?? null;
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tripId);

  try {
    const supabase = await createClient();
    const userQuery = isUuid
      ? await supabase.from("trips").select("*").eq("id", tripId).maybeSingle()
      : await supabase.from("trips").select("*").eq("public_id", tripId).maybeSingle();

    if (userQuery.data) return userQuery.data as Trip;

    const adminQuery = isUuid
      ? await supabaseAdmin.from("trips").select("*").eq("id", tripId).maybeSingle()
      : await supabaseAdmin.from("trips").select("*").eq("public_id", tripId).maybeSingle();

    if (!adminQuery.data) return null;
    return adminQuery.data as Trip;
  } catch {
    try {
      const adminQuery = isUuid
        ? await supabaseAdmin.from("trips").select("*").eq("id", tripId).maybeSingle()
        : await supabaseAdmin.from("trips").select("*").eq("public_id", tripId).maybeSingle();

      if (!adminQuery.data) return null;
      return adminQuery.data as Trip;
    } catch {
      return null;
    }
  }
}

export async function getComparisonOptions(tripId: string): Promise<ComparisonOption[]> {
  if (!hasSupabaseEnv()) return mockComparisonOptions;

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("comparison_options").select("*").eq("trip_id", tripId).order("option_number");
    if (!data || data.length === 0) return mockComparisonOptions;
    return data as ComparisonOption[];
  } catch {
    return mockComparisonOptions;
  }
}

export async function getItineraryItems(tripId: string): Promise<ItineraryItem[]> {
  if (!hasSupabaseEnv()) {
    return mockItineraryItems.filter((item) => item.trip_id === tripId || tripId === "trip_01");
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("itinerary_items").select("*").eq("trip_id", tripId).order("day_number").order("sort_order");
    if (!data || data.length === 0) {
      const { data: adminItems } = await supabaseAdmin
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number")
        .order("sort_order");
      if (!adminItems || adminItems.length === 0) return mockItineraryItems;
      return adminItems as ItineraryItem[];
    }
    return data as ItineraryItem[];
  } catch {
    try {
      const { data } = await supabaseAdmin
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number")
        .order("sort_order");

      if (!data || data.length === 0) return mockItineraryItems;
      return data as ItineraryItem[];
    } catch {
      return mockItineraryItems;
    }
  }
}

export async function getPackingList() {
  return mockPackingList;
}

export async function getVendors(): Promise<VendorSummary[]> {
  if (!hasSupabaseEnv()) return [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("vendors")
      .select("id,name,type,city,whatsapp_number,is_verified")
      .order("is_verified", { ascending: false })
      .order("name", { ascending: true })
      .limit(200);

    return (data as VendorSummary[]) ?? [];
  } catch {
    return [];
  }
}

export async function getWahaLogs(limit = 50) {
  if (!hasSupabaseEnv()) return [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("waha_message_log")
      .select("id,recipient_type,recipient_id,message,status,created_at,sent_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    return data ?? [];
  } catch {
    return [];
  }
}

export async function getFlaggedQueue(limit = 100): Promise<FlaggedQueueItem[]> {
  if (!hasSupabaseEnv()) return [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cs_approval_queue")
      .select("id,trip_id,item_id,status,requested_change,reviewed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!data || data.length === 0) return [];

    const tripIds = [...new Set(data.map((row) => row.trip_id))];
    const itemIds = [...new Set(data.map((row) => row.item_id).filter(Boolean) as string[])];

    const [tripResult, itemResult] = await Promise.all([
      supabase.from("trips").select("id,public_id").in("id", tripIds),
      itemIds.length > 0 ? supabase.from("itinerary_items").select("id,title").in("id", itemIds) : Promise.resolve({ data: [] as Array<{ id: string; title: string }>, error: null }),
    ]);

    const tripMap = new Map((tripResult.data ?? []).map((trip) => [trip.id, trip.public_id]));
    const itemMap = new Map((itemResult.data ?? []).map((item) => [item.id, item.title]));

    return data.map((row) => ({
      ...(row as Omit<FlaggedQueueItem, "trip_public_id" | "item_title">),
      trip_public_id: tripMap.get(row.trip_id) ?? row.trip_id,
      item_title: row.item_id ? itemMap.get(row.item_id) ?? null : null,
    }));
  } catch {
    return [];
  }
}

export async function getOpenChatSessions(limit = 50): Promise<CSChatSession[]> {
  if (!hasSupabaseEnv()) return [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cs_chat_sessions")
      .select("id,trip_id,user_id,cs_id,status,messages,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);

    return (data as CSChatSession[]) ?? [];
  } catch {
    return [];
  }
}

export async function getTripPhotos(tripId: string): Promise<TripPhoto[]> {
  if (!hasSupabaseEnv()) return [];

  try {
    const { data } = await supabaseAdmin
      .from("trip_photos")
      .select("id,trip_id,user_id,storage_path,caption,uploaded_at")
      .eq("trip_id", tripId)
      .order("uploaded_at", { ascending: false })
      .limit(20);

    const rows = (data as TripPhoto[]) ?? [];
    return rows.map((row) => ({
      ...row,
      public_url: supabaseAdmin.storage.from("trip-photos").getPublicUrl(row.storage_path).data.publicUrl,
    }));
  } catch {
    return [];
  }
}

export async function getUsers(limit = 100): Promise<UserProfile[]> {
  if (!hasSupabaseEnv()) return [mockProfile];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("users")
      .select("id,full_name,whatsapp_number,travel_preferences,role,points_balance,lifetime_points,loyalty_tier")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data as UserProfile[]) ?? [];
  } catch {
    return [mockProfile];
  }
}

export async function getTripVendors(tripId: string): Promise<VendorSummary[]> {
  if (!hasSupabaseEnv()) return [];

  try {
    const supabase = await createClient();
    const { data: itineraryItems } = await supabase
      .from("itinerary_items")
      .select("vendor_id")
      .eq("trip_id", tripId)
      .not("vendor_id", "is", null);

    const vendorIds = [...new Set((itineraryItems ?? []).map((item) => item.vendor_id).filter(Boolean))] as string[];
    if (vendorIds.length === 0) return [];

    const { data } = await supabase
      .from("vendors")
      .select("id,name,type,city,whatsapp_number,is_verified")
      .in("id", vendorIds)
      .order("name", { ascending: true });

    return (data as VendorSummary[]) ?? [];
  } catch {
    return [];
  }
}

export async function getAdminMetrics() {
  if (!hasSupabaseEnv()) {
    return {
      tripVolume30d: mockTrips.length,
      revenuePlanningFeeIdr: mockTrips.filter((trip) => trip.payment_status === "paid").reduce((sum, trip) => sum + trip.planning_fee_idr, 0),
      csInterventionRate: 0,
      avgSatisfaction: null as number | null,
      flaggedPending: 0,
      openChats: 0,
    };
  }

  try {
    const supabase = await createClient();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const [tripsResult, flaggedResult, openChatsResult, reviewsResult] = await Promise.all([
      supabase.from("trips").select("id,planning_fee_idr,created_at").gte("created_at", fromDate.toISOString()),
      supabase.from("cs_approval_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("cs_chat_sessions").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("vendor_reviews").select("rating"),
    ]);

    const tripRows = tripsResult.data ?? [];
    const revenuePlanningFeeIdr = tripRows.reduce((sum, trip) => sum + (trip.planning_fee_idr ?? 0), 0);

    const reviewRows = reviewsResult.data ?? [];
    const avgSatisfaction = reviewRows.length > 0 ? reviewRows.reduce((sum, row) => sum + row.rating, 0) / reviewRows.length : null;

    const csInterventionRate = tripRows.length > 0 ? Number((((flaggedResult.count ?? 0) / tripRows.length) * 100).toFixed(1)) : 0;

    return {
      tripVolume30d: tripRows.length,
      revenuePlanningFeeIdr,
      csInterventionRate,
      avgSatisfaction,
      flaggedPending: flaggedResult.count ?? 0,
      openChats: openChatsResult.count ?? 0,
    };
  } catch {
    return {
      tripVolume30d: 0,
      revenuePlanningFeeIdr: 0,
      csInterventionRate: 0,
      avgSatisfaction: null as number | null,
      flaggedPending: 0,
      openChats: 0,
    };
  }
}

export async function redeemPlanningDiscount() {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured" };
  }

  try {
    const {
      data: { user },
    } = await createClient().then((client) => client.auth.getUser());

    if (!user) {
      return { ok: false, error: "Unauthorized" };
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id,points_balance,lifetime_points,loyalty_tier")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return { ok: false, error: "Profile not found" };
    }

    if (profile.points_balance < 500) {
      return { ok: false, error: "Not enough points to redeem" };
    }

    const delta = profile.points_balance >= 1000 ? -1000 : -500;

    const nextPoints = profile.points_balance + delta;
    const nextLifetime = profile.lifetime_points;
    const nextTier = tierFromPoints(nextPoints);

    const [updateUser, updatePoints, insertLog] = await Promise.all([
      supabaseAdmin
        .from("users")
        .update({
          points_balance: nextPoints,
          loyalty_tier: nextTier,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id),
      supabaseAdmin
        .from("user_points")
        .upsert(
          {
            user_id: user.id,
            points_balance: nextPoints,
            lifetime_points: nextLifetime,
            tier: nextTier,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        ),
      supabaseAdmin.from("user_points_log").insert({
        user_id: user.id,
        points_delta: delta,
        event_type: "redeem_planning_fee",
        reference_id: `redeem_${Date.now()}`,
      }),
    ]);

    if (updateUser.error || updatePoints.error || insertLog.error) {
      return {
        ok: false,
        error: updateUser.error?.message ?? updatePoints.error?.message ?? insertLog.error?.message ?? "Failed to redeem points",
      };
    }

    return {
      ok: true,
      redeemedPoints: Math.abs(delta),
    };
  } catch {
    return { ok: false, error: "Failed to redeem points" };
  }
}
