import { generateText, tool } from "ai";
import { z } from "zod";

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
    intakeData: Record<string, unknown>;
  };

  await supabaseAdmin.from("trips").update({ status: "generating" }).eq("id", body.tripId);

  const result = await generateText({
    model,
    prompt: `
You are TravelYu itinerary generation engine.

Trip ID: ${body.tripId}
Intake data: ${JSON.stringify(body.intakeData)}

Generate a 3-5 day itinerary with complete item fields.
After generation, call save_itinerary tool with structured payload.
`,
    tools: {
      save_itinerary: saveItineraryTool,
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
