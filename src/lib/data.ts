import { cacheLife, cacheTag, revalidateTag } from "next/cache";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import {
  mockComparisonOptions,
  mockItineraryItems,
  mockPackingList,
  mockProfile,
  mockTrips,
} from "@/lib/mock-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function getProfile(userId: string): Promise<UserProfile> {
  "use cache";
  cacheLife({ revalidate: 300, expire: 3600 });
  cacheTag(`user:${userId}:profile`);

    if (!hasSupabaseEnv()) {
      return {
        ...mockProfile,
        id: userId,
      };
    }

  try {
    const { data } = await supabaseAdmin.from("users").select("*").eq("id", userId).single();

    if (!data) {
      return {
        ...mockProfile,
        id: userId,
        role: "user",
      };
    }

    return data as UserProfile;
  } catch {
    return {
      ...mockProfile,
      id: userId,
      role: "user",
    };
  }
}

export async function getTrips(): Promise<Trip[]> {
  if (!hasSupabaseEnv()) return mockTrips;

  try {
    const appUser = await getCurrentAppUser();
    if (!appUser) return mockTrips;

    let query = supabaseAdmin
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!isAdminRole(appUser.role)) {
      query = query.eq("user_id", appUser.id);
    }

    const { data } = await query;
    return (data as Trip[]) ?? mockTrips;
  } catch {
    return mockTrips;
  }
}

export async function getTripById(tripId: string): Promise<Trip | null> {
  "use cache";
  cacheLife({ revalidate: 30, expire: 600 });
  cacheTag(`trip:${tripId}`);

  if (!hasSupabaseEnv()) {
    return mockTrips.find((trip) => trip.id === tripId || trip.public_id === tripId) ?? null;
  }

  const isUuid = UUID_RE.test(tripId);

  try {
    const { data } = isUuid
      ? await supabaseAdmin.from("trips").select("*").eq("id", tripId).maybeSingle()
      : await supabaseAdmin.from("trips").select("*").eq("public_id", tripId).maybeSingle();

    if (data) {
      cacheTag(`trip:${data.id}`);
      cacheTag(`trip:${data.public_id}`);
    }

    return (data as Trip) ?? null;
  } catch {
    return null;
  }
}

export async function getComparisonOptions(tripId: string): Promise<ComparisonOption[]> {
  "use cache";
  cacheLife({ revalidate: 30, expire: 600 });
  cacheTag(`trip:${tripId}:comparison-options`);

  if (!hasSupabaseEnv()) return mockComparisonOptions;

  try {
    const { data } = await supabaseAdmin
      .from("comparison_options")
      .select("*")
      .eq("trip_id", tripId)
      .order("option_number");

    if (!data || data.length === 0) return [];
    return data as ComparisonOption[];
  } catch {
    return [];
  }
}

export async function getItineraryItems(tripId: string): Promise<ItineraryItem[]> {
  "use cache";
  cacheLife({ revalidate: 30, expire: 600 });
  cacheTag(`trip:${tripId}:items`);

  if (!hasSupabaseEnv()) {
    return mockItineraryItems.filter((item) => item.trip_id === tripId || tripId === "trip_01");
  }

  try {
    const { data } = await supabaseAdmin
      .from("itinerary_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number")
      .order("sort_order");

    if (!data || data.length === 0) return [];
    return data as ItineraryItem[];
  } catch {
    return [];
  }
}

export type PackingItem = { item: string; category: string; checked: boolean };

export async function getOrGeneratePackingList(
  tripId: string,
): Promise<PackingItem[]> {
  if (!hasSupabaseEnv()) return mockPackingList as PackingItem[];

  // 1. Check if already generated & cached in intake_data
  try {
    const { data: tripRow } = await supabaseAdmin
      .from("trips")
      .select("intake_data, status")
      .eq("id", tripId)
      .maybeSingle();

    if (!tripRow) return mockPackingList as PackingItem[];

    const intakeData = (tripRow.intake_data ?? {}) as Record<string, unknown>;

    if (Array.isArray(intakeData.packingList) && intakeData.packingList.length > 0) {
      return intakeData.packingList as PackingItem[];
    }

    // Only generate for workspace-ready trips
    if (!["approved", "active", "completed"].includes(String(tripRow.status))) {
      return mockPackingList as PackingItem[];
    }

    // 2. Generate via AI
    const destination = String(intakeData.where ?? "Indonesia");
    const vibe = String(intakeData.vibe ?? "");
    const when = String(intakeData.when ?? "3 hari");
    const who = String(intakeData.who ?? "");

    const { generateText } = await import("ai");
    const { model } = await import("@/lib/ai/openrouter");

    const { text } = await generateText({
      model,
      maxRetries: 1,
      prompt: `Generate packing list untuk trip ke ${destination} (${when}), vibe: ${vibe}, peserta: ${who}.
Return JSON array only, no markdown:
[{"item": "...", "category": "Essentials|Clothing|Documents|Health|Electronics|Activities", "checked": false}]
Max 25 items. Very concise item names in Bahasa Indonesia.`,
    });

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    const parsed = JSON.parse(jsonMatch[0]) as PackingItem[];

    // 3. Cache back to intake_data
    await supabaseAdmin
      .from("trips")
      .update({
        intake_data: { ...intakeData, packingList: parsed },
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);

    return parsed;
  } catch {
    return mockPackingList as PackingItem[];
  }
}

/** @deprecated Use getOrGeneratePackingList instead */
export async function getPackingList() {
  return mockPackingList;
}


export async function getVendors(): Promise<VendorSummary[]> {
  "use cache";
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag("vendors");

  if (!hasSupabaseEnv()) return [];

  try {
    const { data } = await supabaseAdmin
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

export async function getWhatsappLogs(limit = 50) {
  if (!hasSupabaseEnv()) return [];

  try {
    const appUser = await getCurrentAppUser();
    if (!appUser || !isAdminRole(appUser.role)) return [];

    const { data } = await supabaseAdmin
      .from("waha_message_log")
      .select("id,recipient_type,recipient_id,message,status,created_at,sent_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    return data ?? [];
  } catch {
    return [];
  }
}

type FlaggedQueueRow = {
  id: string;
  trip_id: string;
  item_id: string | null;
  status: FlaggedQueueItem["status"];
  requested_change: Record<string, unknown> | null;
  reviewed_at: string | null;
  created_at: string;
  trips: { public_id: string } | { public_id: string }[] | null;
  itinerary_items: { title: string } | { title: string }[] | null;
};

export async function getFlaggedQueue(limit = 100): Promise<FlaggedQueueItem[]> {
  if (!hasSupabaseEnv()) return [];

  try {
    const appUser = await getCurrentAppUser();
    if (!appUser || !isAdminRole(appUser.role)) return [];

    const { data } = await supabaseAdmin
      .from("cs_approval_queue")
      .select(
        "id,trip_id,item_id,status,requested_change,reviewed_at,created_at,trips!inner(public_id),itinerary_items(title)",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    const rows = (data as FlaggedQueueRow[] | null) ?? [];

    return rows.map((row) => {
      const tripRecord = Array.isArray(row.trips) ? row.trips[0] : row.trips;
      const itemRecord = Array.isArray(row.itinerary_items)
        ? row.itinerary_items[0]
        : row.itinerary_items;

      return {
        id: row.id,
        trip_id: row.trip_id,
        item_id: row.item_id,
        status: row.status,
        requested_change: row.requested_change,
        reviewed_at: row.reviewed_at,
        created_at: row.created_at,
        trip_public_id: tripRecord?.public_id ?? row.trip_id,
        item_title: itemRecord?.title ?? null,
      };
    });
  } catch {
    return [];
  }
}

export async function getOpenChatSessions(limit = 50): Promise<CSChatSession[]> {
  if (!hasSupabaseEnv()) return [];

  try {
    const appUser = await getCurrentAppUser();
    if (!appUser || !isAdminRole(appUser.role)) return [];

    const { data } = await supabaseAdmin
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
  "use cache";
  cacheLife({ revalidate: 30, expire: 300 });
  cacheTag(`trip:${tripId}:photos`);

  if (!hasSupabaseEnv()) return [];

  const toPublic = (rows: TripPhoto[]) =>
    rows.map((row) => ({
      ...row,
      public_url: supabaseAdmin.storage.from("trip-photos").getPublicUrl(row.storage_path).data.publicUrl,
    }));

  try {
    // New scrapbook columns (migration 014); fall back when not yet applied
    const { data, error } = await supabaseAdmin
      .from("trip_photos")
      .select("id,trip_id,user_id,storage_path,caption,uploaded_at,itinerary_item_id,taken_at,day_number")
      .eq("trip_id", tripId)
      .order("uploaded_at", { ascending: false })
      .limit(100);

    if (!error && data) return toPublic(data as TripPhoto[]);

    const retry = await supabaseAdmin
      .from("trip_photos")
      .select("id,trip_id,user_id,storage_path,caption,uploaded_at")
      .eq("trip_id", tripId)
      .order("uploaded_at", { ascending: false })
      .limit(20);

    return toPublic((retry.data as TripPhoto[] | null) ?? []);
  } catch {
    return [];
  }
}

export async function getTripBookings(tripId: string) {
  if (!hasSupabaseEnv()) return [];
  try {
    const { data, error } = await supabaseAdmin
      .from("trip_bookings")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data ?? []) as import("@/types/domain").TripBooking[];
  } catch {
    return [];
  }
}

export async function getUsers(limit = 100): Promise<UserProfile[]> {
  if (!hasSupabaseEnv()) return [mockProfile];

  try {
    const appUser = await getCurrentAppUser();
    if (!appUser || !isAdminRole(appUser.role)) return [mockProfile];

    const { data } = await supabaseAdmin
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
    const { data: itineraryItems } = await supabaseAdmin
      .from("itinerary_items")
      .select("vendor_id")
      .eq("trip_id", tripId)
      .not("vendor_id", "is", null);

    const vendorIds = [...new Set((itineraryItems ?? []).map((item) => item.vendor_id).filter(Boolean))] as string[];
    if (vendorIds.length === 0) return [];

    const { data } = await supabaseAdmin
      .from("vendors")
      .select("id,name,type,city,whatsapp_number,is_verified")
      .in("id", vendorIds)
      .order("name", { ascending: true });

    return (data as VendorSummary[]) ?? [];
  } catch {
    return [];
  }
}

export async function getAdminMetrics(adminUserId: string) {
  "use cache";
  cacheLife({ revalidate: 120, expire: 1800 });
  cacheTag("admin:metrics");
  cacheTag(`admin:${adminUserId}:metrics`);

  if (!hasSupabaseEnv()) {
    return {
      tripVolume30d: mockTrips.length,
      revenuePlanningFeeIdr: mockTrips.reduce((sum, trip) => sum + trip.planning_fee_idr, 0),
      csInterventionRate: 0,
      avgSatisfaction: null as number | null,
      flaggedPending: 0,
      openChats: 0,
    };
  }

  try {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const [tripsResult, flaggedResult, openChatsResult, reviewsResult] = await Promise.all([
      supabaseAdmin
        .from("trips")
        .select("id,planning_fee_idr,created_at")
        .gte("created_at", fromDate.toISOString()),
      supabaseAdmin
        .from("cs_approval_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("cs_chat_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabaseAdmin.from("vendor_reviews").select("rating"),
    ]);

    const tripRows = tripsResult.data ?? [];
    const revenuePlanningFeeIdr = tripRows.reduce(
      (sum, trip) => sum + (trip.planning_fee_idr ?? 0),
      0,
    );

    const reviewRows = reviewsResult.data ?? [];
    const avgSatisfaction =
      reviewRows.length > 0
        ? reviewRows.reduce((sum, row) => sum + row.rating, 0) / reviewRows.length
        : null;

    const csInterventionRate =
      tripRows.length > 0
        ? Number((((flaggedResult.count ?? 0) / tripRows.length) * 100).toFixed(1))
        : 0;

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

type RedeemRpcResult = {
  ok: boolean;
  error?: string;
  new_balance?: number;
};

export async function redeemPlanningDiscount() {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured" };
  }

  try {
    const appUser = await getCurrentAppUser();
    if (!appUser) {
      return { ok: false, error: "Unauthorized" };
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("points_balance")
      .eq("id", appUser.id)
      .single();

    if (!profile) {
      return { ok: false, error: "Profile not found" };
    }

    if (profile.points_balance < 500) {
      return { ok: false, error: "Not enough points to redeem" };
    }

    const pointsToDeduct = profile.points_balance >= 1000 ? 1000 : 500;

    const { data, error } = await supabaseAdmin.rpc("redeem_planning_points", {
      p_user_id: appUser.id,
      p_points_to_deduct: pointsToDeduct,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    const payload = (data ?? null) as RedeemRpcResult | null;
    if (!payload?.ok) {
      return { ok: false, error: payload?.error ?? "Failed to redeem points" };
    }

    revalidateTag(`user:${appUser.id}:profile`, "max");

    return {
      ok: true,
      redeemedPoints: pointsToDeduct,
      newBalance: payload.new_balance ?? null,
    };
  } catch {
    return { ok: false, error: "Failed to redeem points" };
  }
}
