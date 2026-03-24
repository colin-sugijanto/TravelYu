import { generateText, tool } from "ai";
import { z } from "zod";

import { searchIndonesiaPlaces } from "@/lib/ai/tavily";
import { model } from "@/lib/ai/openrouter";
import { resolveTripRecipient, sendTravelYuNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

const saveItineraryTool = tool({
  description: "Save generated itinerary items to Supabase",
  inputSchema: z.object({
    tripId: z.string(),
    totalEstCostIdr: z.number().int().min(0),
    items: z.array(
      z.object({
        day: z.number().int().min(1),
        timeSlot: z.enum(["morning", "afternoon", "evening", "night"]),
        activityType: z.enum(["accommodation", "transport", "dining", "attraction", "experience", "rest"]),
        title: z.string(),
        description: z.string(),
        estCostIdr: z.number().int().min(0),
        locationAddress: z.string().optional(),
        source: z.enum(["internal_db", "web_search", "provider_api", "manual_cs"]).default("web_search"),
      }),
    ),
  }),
  execute: async (input) => {
    await supabaseAdmin.from("itinerary_items").delete().eq("trip_id", input.tripId);

    const rows = input.items.map((item, idx) => ({
      trip_id: input.tripId,
      day_number: item.day,
      time_slot: item.timeSlot,
      sort_order: idx + 1,
      activity_type: item.activityType,
      title: item.title,
      description: item.description,
      est_cost_idr: item.estCostIdr,
      location_address: item.locationAddress ?? null,
      status: "draft",
      source: item.source,
    }));

    await supabaseAdmin.from("itinerary_items").insert(rows);
    await supabaseAdmin
      .from("trips")
      .update({ status: "draft", total_est_cost_idr: input.totalEstCostIdr, updated_at: new Date().toISOString() })
      .eq("id", input.tripId);

    return { ok: true, itemCount: rows.length };
  },
});

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "AI itinerary generation service is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    tripId: string;
    intakeData?: Record<string, unknown>;
  };

  if (!body.tripId) {
    return Response.json({ error: "tripId is required" }, { status: 400 });
  }

  const { data: trip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("id,intake_data,payment_status,selected_comparison_option")
    .eq("id", body.tripId)
    .single();

  if (tripError || !trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.payment_status !== "paid") {
    return Response.json({ error: "Payment must be completed before itinerary generation" }, { status: 400 });
  }

  await supabaseAdmin.from("trips").update({ status: "generating" }).eq("id", body.tripId);

  const intakeData = body.intakeData ?? ((trip.intake_data as Record<string, unknown> | null) ?? {});
  const comparisonOption = trip.selected_comparison_option ?? 1;

  const result = await generateText({
    model,
    system: "You are TravelYu itinerary generation engine for Indonesian destinations.",
    prompt: `
You are TravelYu itinerary generation engine.

Trip ID: ${body.tripId}
Intake data: ${JSON.stringify(intakeData)}
Selected comparison option: ${comparisonOption}

Generate a 3-5 day itinerary with complete item fields.
After generation, call save_itinerary tool with structured payload.

If you need fresh activity ideas, use search_indonesia_places tool.
`,
    tools: {
      save_itinerary: saveItineraryTool,
      search_indonesia_places: tool({
        description: "Search Indonesian places, attractions, restaurants, and activities.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(8).default(5),
        }),
        execute: async ({ query, limit }) => {
          const results = await searchIndonesiaPlaces(query, limit);
          return {
            ok: true,
            results,
          };
        },
      }),
    },
  });

  const recipient = await resolveTripRecipient(body.tripId);
  if (recipient) {
    await sendTravelYuNotification({
      eventType: "itinerary_ready",
      tripId: recipient.tripId,
      userName: recipient.userName,
      email: recipient.email,
      phoneE164: recipient.phoneE164,
      channelPreference: "both",
    });
  }

  return Response.json({
    ok: true,
    message: result.text,
  });
}
