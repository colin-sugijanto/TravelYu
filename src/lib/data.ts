import { mockComparisonOptions, mockItineraryItems, mockPackingList, mockProfile, mockTrips } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { ComparisonOption, ItineraryItem, Trip, UserProfile } from "@/types/domain";

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

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("trips").select("*").or(`id.eq.${tripId},public_id.eq.${tripId}`).limit(1);
    if (!data || data.length === 0) return null;
    return data[0] as Trip;
  } catch {
    return null;
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
    if (!data || data.length === 0) return mockItineraryItems;
    return data as ItineraryItem[];
  } catch {
    return mockItineraryItems;
  }
}

export async function getPackingList() {
  return mockPackingList;
}
