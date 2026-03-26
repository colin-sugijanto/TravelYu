import { generateText, tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { searchIndonesiaPlaces } from "@/lib/ai/tavily";
import { getCurrentAppUser } from "@/lib/auth";
import { model } from "@/lib/ai/openrouter";
import { parseAiProviderError } from "@/lib/ai/errors";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ComparisonSummary = {
  title?: string;
  destinationHighlights?: string[];
  vibeTags?: string[];
  estimatedBudgetIdr?: number;
  rationale?: string;
};

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

    const { error: insertError } = await supabaseAdmin.from("itinerary_items").insert(rows);
    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    const { error: updateError } = await supabaseAdmin
      .from("trips")
      .update({ status: "draft", total_est_cost_idr: input.totalEstCostIdr, updated_at: new Date().toISOString() })
      .eq("id", input.tripId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    revalidateTag(`trip:${input.tripId}:items`, "max");
    revalidateTag(`trip:${input.tripId}`, "max");
    revalidateTag("admin:metrics", "max");

    return { ok: true, itemCount: rows.length };
  },
});

export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await checkAiRateLimit(appUser.id, "generate-trip");
  if (blocked) {
    return blocked;
  }

  if (!process.env.OPENROUTER_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "AI itinerary generation service is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    tripId: string;
    intakeData?: Record<string, unknown>;
    selectedOption?: number;
  };

  if (!body.tripId) {
    return Response.json({ error: "tripId is required" }, { status: 400 });
  }

  const { data: trip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("id,user_id,intake_data,selected_comparison_option")
    .eq("id", body.tripId)
    .single();

  if (tripError || !trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id && appUser.role !== "admin" && appUser.role !== "super_admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabaseAdmin
    .from("trips")
    .update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("id", body.tripId);

  const intakeData = body.intakeData ?? ((trip.intake_data as Record<string, unknown> | null) ?? {});
  const comparisonOption = body.selectedOption ?? trip.selected_comparison_option;

  if (!comparisonOption || comparisonOption < 1 || comparisonOption > 3) {
    await supabaseAdmin
      .from("trips")
      .update({ status: "intake", updated_at: new Date().toISOString() })
      .eq("id", body.tripId);

    return Response.json({ error: "Pilih opsi comparison dulu sebelum generate itinerary." }, { status: 400 });
  }

  const { data: selectedOptionRow, error: selectedOptionError } = await supabaseAdmin
    .from("comparison_options")
    .select("summary")
    .eq("trip_id", body.tripId)
    .eq("option_number", comparisonOption)
    .maybeSingle();

  if (selectedOptionError || !selectedOptionRow) {
    await supabaseAdmin
      .from("trips")
      .update({ status: "intake", updated_at: new Date().toISOString() })
      .eq("id", body.tripId);

    return Response.json(
      { error: "Opsi comparison terpilih tidak ditemukan. Coba generate comparison ulang." },
      { status: 400 },
    );
  }

  const selectedSummary = (selectedOptionRow.summary ?? {}) as ComparisonSummary;

  const selectedOptionContext = {
    optionNumber: comparisonOption,
    title: selectedSummary.title ?? "",
    destinationHighlights: Array.isArray(selectedSummary.destinationHighlights)
      ? selectedSummary.destinationHighlights
      : [],
    vibeTags: Array.isArray(selectedSummary.vibeTags) ? selectedSummary.vibeTags : [],
    estimatedBudgetIdr:
      typeof selectedSummary.estimatedBudgetIdr === "number"
        ? selectedSummary.estimatedBudgetIdr
        : null,
    rationale: selectedSummary.rationale ?? "",
  };

  try {
    const result = await generateText({
      model,
      maxRetries: 2,
      system: "You are TravelYu itinerary generation engine for Indonesian destinations.",
      prompt: `
You are TravelYu itinerary generation engine.

Trip ID: ${body.tripId}
Intake data: ${JSON.stringify(intakeData)}
Selected comparison option: ${comparisonOption}
Selected option details: ${JSON.stringify(selectedOptionContext)}

Generate a 3-5 day itinerary with complete item fields.
The generated itinerary MUST follow the selected option details (destinations, vibe, and budget direction).
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
      scheduleNotification({
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
  } catch (error) {
    await supabaseAdmin
      .from("trips")
      .update({ status: "intake", updated_at: new Date().toISOString() })
      .eq("id", body.tripId);

    const parsed = parseAiProviderError(error, {
      defaultMessage: "AI itinerary gagal sementara. Coba generate ulang dalam beberapa saat.",
      rateLimitedMessage: "Layanan AI sedang padat (rate-limited). Coba lagi 20-60 detik lagi.",
    });

    return Response.json(
      {
        error: parsed.userMessage,
      },
      {
        status: parsed.isRateLimited ? 429 : 503,
        headers: parsed.retryAfterSeconds
          ? {
              "Retry-After": String(parsed.retryAfterSeconds),
            }
          : undefined,
      },
    );
  }
}
