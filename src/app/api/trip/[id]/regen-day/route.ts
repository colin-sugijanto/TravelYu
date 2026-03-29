import { generateText } from "ai";
import { revalidateTag } from "next/cache";

import { getCurrentAppUser } from "@/lib/auth";
import { model } from "@/lib/ai/provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { dayNumber: number };
  try {
    body = (await request.json()) as { dayNumber: number };
    if (!body.dayNumber || typeof body.dayNumber !== "number") {
      return Response.json({ error: "dayNumber is required" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Ownership check
  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id,user_id,intake_data")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  if (trip.user_id !== appUser.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const intakeData = (trip.intake_data ?? {}) as Record<string, unknown>;
  const destination = String(intakeData.where ?? "Indonesia");
  const vibe = String(intakeData.vibe ?? "mixed");
  const pacing = String(intakeData.pacing ?? "balanced");
  const budget = String(intakeData.budget ?? "");

  const maxItemsPerDay = pacing === "slow" ? 3 : pacing === "packed" ? 7 : 5;

  try {
    const { text } = await generateText({
      model,
      maxRetries: 1,
      prompt: `Regenerate the itinerary for Day ${body.dayNumber} of a trip to ${destination}.
Vibe: ${vibe}, Pacing: ${pacing}, Budget: ${budget}.
Return ONLY a JSON array (no markdown) of ${maxItemsPerDay} items for this day:
[{"day": ${body.dayNumber}, "timeSlot": "morning|afternoon|evening|night", "activityType": "accommodation|transport|dining|attraction|experience|rest", "title": "...", "description": "...", "estCostIdr": 0, "locationAddress": "...", "locationLat": 0, "locationLng": 0, "source": "web_search"}]
Must include at least 1 dining item. No fictional venues — use real Indonesian places.`,
    });

    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (!arrMatch) return Response.json({ error: "AI returned invalid output" }, { status: 500 });

    const newItems = JSON.parse(arrMatch[0]) as Array<{
      day: number;
      timeSlot: string;
      activityType: string;
      title: string;
      description: string;
      estCostIdr?: number;
      locationAddress?: string;
      locationLat?: number;
      locationLng?: number;
      source?: string;
    }>;

    if (!Array.isArray(newItems) || newItems.length === 0) {
      return Response.json({ error: "AI returned no items" }, { status: 500 });
    }

    // Delete existing items for this day
    await supabaseAdmin
      .from("itinerary_items")
      .delete()
      .eq("trip_id", tripId)
      .eq("day_number", body.dayNumber);

    // Insert new items
    const rows = newItems.map((item, idx) => ({
      trip_id: tripId,
      day_number: body.dayNumber,
      time_slot: item.timeSlot,
      sort_order: idx + 1,
      activity_type: item.activityType,
      title: item.title,
      description: item.description,
      est_cost_idr: item.estCostIdr ?? 0,
      location_address: item.locationAddress ?? null,
      location_lat: typeof item.locationLat === "number" ? item.locationLat : null,
      location_lng: typeof item.locationLng === "number" ? item.locationLng : null,
      booking_url: null,
      status: "draft",
      source: item.source ?? "web_search",
    }));

    await supabaseAdmin.from("itinerary_items").insert(rows);

    revalidateTag(`trip:${tripId}:items`, "max");

    return Response.json({ ok: true, itemCount: rows.length });
  } catch (err) {
    console.error("[regen-day] Error:", err);
    return Response.json({ error: "AI regen gagal. Coba lagi." }, { status: 503 });
  }
}
