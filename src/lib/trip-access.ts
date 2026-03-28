import { supabaseAdmin } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

export async function findTripByIdentifier<T>(identifier: string, select: string) {
  const query = supabaseAdmin.from("trips").select(select);

  const { data, error } = isUuid(identifier)
    ? await query.eq("id", identifier).maybeSingle()
    : await query.eq("public_id", identifier).maybeSingle();

  if (error) return { data: null as T | null, error };
  return { data: (data as T | null) ?? null, error: null };
}

export async function isTripMember(tripId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("group_trip_members")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}
