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
import { validateRequest, generateTripSchema } from "@/lib/validators";

type ComparisonSummary = {
  title?: string;
  destinationHighlights?: string[];
  vibeTags?: string[];
  estimatedBudgetIdr?: number;
  rationale?: string;
};

type SaveItineraryResult =
  | { ok: true; itemCount: number }
  | { ok: false; error: string };

const itineraryPayloadSchema = z.object({
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
});

async function persistGeneratedItinerary(input: z.infer<typeof itineraryPayloadSchema>): Promise<SaveItineraryResult> {
  try {
    const nextTripStatus = process.env.NODE_ENV === "production" ? "draft" : "approved";

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
      .update({ status: nextTripStatus, total_est_cost_idr: input.totalEstCostIdr, updated_at: new Date().toISOString() })
      .eq("id", input.tripId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    revalidateTag(`trip:${input.tripId}:items`, "max");
    revalidateTag(`trip:${input.tripId}`, "max");
    revalidateTag("admin:metrics", "max");

    return { ok: true, itemCount: rows.length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown itinerary save error",
    };
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }

  const fencedMatches = text.match(/```(?:json)?\s*([\s\S]*?)```/gi) ?? [];
  for (const block of fencedMatches) {
    const stripped = block.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    try {
      const parsed = JSON.parse(stripped) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(slice) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function parseFallbackItinerary(text: string): z.infer<typeof itineraryPayloadSchema> | null {
  const obj = extractJsonObject(text);
  if (!obj) return null;

  const parsed = itineraryPayloadSchema.safeParse(obj);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function createSaveItineraryTool(onComplete: (result: SaveItineraryResult) => void) {
  return tool({
    description: "Save generated itinerary items to Supabase",
    inputSchema: itineraryPayloadSchema,
    execute: async (input) => {
      const result = await persistGeneratedItinerary(input);
      onComplete(result);
      return result;
    },
  });
}

export async function POST(request: Request) {
  let saveItineraryResult: SaveItineraryResult | null = null;
  const saveItineraryTool = createSaveItineraryTool((result) => {
    saveItineraryResult = result;
  });

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

  let body: { tripId: string; intakeData?: Record<string, unknown>; selectedOption?: number };
  try {
    const rawData = await request.json();
    body = validateRequest(generateTripSchema, rawData);
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      const validationError = error as unknown as { errors: Array<{ field: string; message: string }> };
      return Response.json(
        { error: "Invalid input", details: validationError.errors },
        { status: 400 },
      );
    }
    return Response.json({ error: "Invalid request body" }, { status: 400 });
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
  
  const sanitizeForPrompt = (obj: Record<string, unknown>): string => {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        sanitized[key] = value.slice(0, 2000);
      } else if (typeof value !== "function" && typeof value !== "symbol") {
        sanitized[key] = value;
      }
    }
    return JSON.stringify(sanitized).slice(0, 10000);
  };
  
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const basePrompt = `
You are TravelYu itinerary generation engine.

Trip ID: ${body.tripId}
Intake data: ${sanitizeForPrompt(intakeData)}
Selected comparison option: ${comparisonOption}
Selected option details: ${JSON.stringify(selectedOptionContext)}

Generate a 3-5 day itinerary with complete item fields.
The generated itinerary MUST follow the selected option details (destinations, vibe, and budget direction).
IMPORTANT: You MUST call the save_itinerary tool with the complete itinerary data before finishing.
Do not output the itinerary in text form - only call the save_itinerary tool.

If you need fresh activity ideas, use search_indonesia_places tool first.
`;

    const result = await generateText({
      model,
      maxRetries: 2,
      abortSignal: controller.signal,
      toolChoice: { type: "tool", toolName: "save_itinerary" },
      system: "You are TravelYu itinerary generation engine for Indonesian destinations.",
      prompt: basePrompt,
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

    const savedResult = saveItineraryResult as SaveItineraryResult | null;

    if (!savedResult) {
      const fallback = await generateText({
        model,
        maxRetries: 1,
        system: "You are TravelYu itinerary generation engine for Indonesian destinations.",
        prompt: `${basePrompt}

Return ONLY a valid JSON object (without markdown) with this exact structure:
{
  "tripId": "${body.tripId}",
  "totalEstCostIdr": 0,
  "items": [
    {
      "day": 1,
      "timeSlot": "morning|afternoon|evening|night",
      "activityType": "accommodation|transport|dining|attraction|experience|rest",
      "title": "...",
      "description": "...",
      "estCostIdr": 0,
      "locationAddress": "optional",
      "source": "internal_db|web_search|provider_api|manual_cs"
    }
  ]
}`,
      });

      const fallbackPayload = parseFallbackItinerary(fallback.text);
      if (fallbackPayload) {
        const fallbackSavedResult = await persistGeneratedItinerary(fallbackPayload);
        if (fallbackSavedResult.ok && fallbackSavedResult.itemCount > 0) {
          saveItineraryResult = fallbackSavedResult;
        }
      } else {
        console.error("[generate-trip] Fallback JSON parse failed");
      }
    }

    clearTimeout(timeoutId);

    const finalSavedResult = (saveItineraryResult as SaveItineraryResult | null) ?? null;

    if (!finalSavedResult) {
      await supabaseAdmin
        .from("trips")
        .update({
          status: "intake",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.tripId);

      return Response.json(
        {
          error: "AI gagal menyimpan itinerary. Coba generate ulang dalam beberapa saat.",
        },
        { status: 503 },
      );
    }

    if (!finalSavedResult.ok) {
      await supabaseAdmin
        .from("trips")
        .update({
          status: "intake",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.tripId);

      return Response.json(
        {
          error: "AI gagal menyimpan itinerary. Coba generate ulang dalam beberapa saat.",
        },
        { status: 503 },
      );
    }

    if (finalSavedResult.itemCount < 1) {
      await supabaseAdmin
        .from("trips")
        .update({
          status: "intake",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.tripId);

      return Response.json(
        {
          error: "AI gagal menyimpan itinerary. Coba generate ulang dalam beberapa saat.",
        },
        { status: 503 },
      );
    }

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
    console.error("[generate-trip] Error during generation:", error);

    const isTimeout = error instanceof Error && error.name === "AbortError";
    
    await supabaseAdmin
      .from("trips")
      .update({ 
        status: "intake", 
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.tripId);

    const parsed = parseAiProviderError(error, {
      defaultMessage: isTimeout 
        ? "AI itinerary timeout setelah 3 menit. Coba generate ulang." 
        : "AI itinerary gagal sementara. Coba generate ulang dalam beberapa saat.",
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
          : {},
      },
    );
  }
}
