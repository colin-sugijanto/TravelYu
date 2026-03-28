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
import { validateItinerary } from "@/lib/ai/validate-itinerary";
import { parseTripDateRangeFromWhen, toIsoDateOnly } from "@/lib/trip-dates";

const HTTP_URL_REGEX = /^https?:\/\//i;

function ensureValidHttpUrl(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!HTTP_URL_REGEX.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

function fallbackMapsUrl(input: {
  title: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
}) {
  if (typeof input.locationLat === "number" && typeof input.locationLng === "number") {
    return `https://www.google.com/maps?q=${input.locationLat},${input.locationLng}`;
  }

  const query = input.locationAddress?.trim() || input.title.trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

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
      locationLat: z.number().optional(),
      locationLng: z.number().optional(),
      bookingUrl: z.string().url().optional(),
      source: z.enum(["internal_db", "web_search", "provider_api", "manual_cs"]).default("web_search"),
    }),
  ),
});

async function persistGeneratedItinerary(input: z.infer<typeof itineraryPayloadSchema>): Promise<SaveItineraryResult> {
  try {
    const nextTripStatus = process.env.NODE_ENV === "production" ? "draft" : "approved";

    await supabaseAdmin.from("itinerary_items").delete().eq("trip_id", input.tripId);

    const rows = input.items.map((item, idx) => {
      const validatedBookingUrl = ensureValidHttpUrl(item.bookingUrl);
      const fallbackBookingUrl = fallbackMapsUrl({
        title: item.title,
        locationAddress: item.locationAddress,
        locationLat: item.locationLat,
        locationLng: item.locationLng,
      });

      return {
      trip_id: input.tripId,
      day_number: item.day,
      time_slot: item.timeSlot,
      sort_order: idx + 1,
      activity_type: item.activityType,
      title: item.title,
      description: item.description,
      est_cost_idr: item.estCostIdr,
      location_address: item.locationAddress ?? null,
      location_lat: typeof item.locationLat === "number" ? item.locationLat : null,
      location_lng: typeof item.locationLng === "number" ? item.locationLng : null,
      booking_url: validatedBookingUrl ?? fallbackBookingUrl,
      status: "draft",
      source: item.source,
      };
    });

    // Validate before insert — log warnings but don't block user on minor issues
    const validation = validateItinerary(input.items);
    if (!validation.valid) {
      console.warn("[generate-trip] Itinerary validation warnings:", validation.errors.join(" | "));
    }

    const { error: insertError } = await supabaseAdmin.from("itinerary_items").insert(rows);
    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    const { data: tripRow } = await supabaseAdmin
      .from("trips")
      .select("intake_data")
      .eq("id", input.tripId)
      .maybeSingle();

    const intakeData = (tripRow?.intake_data ?? null) as Record<string, unknown> | null;
    const whenText = typeof intakeData?.when === "string" ? intakeData.when : undefined;
    const parsedRange = parseTripDateRangeFromWhen(whenText);

    const { error: updateError } = await supabaseAdmin
      .from("trips")
      .update({
        status: nextTripStatus,
        total_est_cost_idr: input.totalEstCostIdr,
        trip_start_date: parsedRange ? toIsoDateOnly(parsedRange.startDate) : null,
        trip_end_date: parsedRange ? toIsoDateOnly(parsedRange.endDate) : null,
        updated_at: new Date().toISOString(),
      })
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
    .select("id,user_id,intake_data,selected_comparison_option,total_est_cost_idr")
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

  // Fetch verified vendors for this destination from the DB
  const destinationCity = String(
    (intakeData as Record<string, unknown>).where ?? ""
  ).split(/[,\s]/)[0] ?? "";

  const { data: relevantVendors } = destinationCity
    ? await supabaseAdmin
        .from("vendors")
        .select("id,name,type,city,price_tier,avg_rating,tags")
        .ilike("city", `%${destinationCity}%`)
        .eq("is_verified", true)
        .limit(30)
    : { data: null };

  const vendorContext =
    relevantVendors && relevantVendors.length > 0
      ? relevantVendors
          .map(
            (v) =>
              `[${String(v.type).toUpperCase()}] ${
                v.name
              } | ${v.city} | ${v.price_tier} | ${Number(v.avg_rating).toFixed(1)}★ | ${Array.isArray(v.tags) ? (v.tags as string[]).join(", ") : ""}`,
          )
          .join("\n")
      : "No pre-seeded vendors found for this destination — generate realistic Indonesian venue names.";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[generate-trip] Timeout reached for trip ${body.tripId}, aborting...`);
      controller.abort();
    }, 600000);

    console.log(`[generate-trip] Starting generation for trip ${body.tripId} with 10min timeout`);

    const todayJakarta = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date());

    const GENERATION_SYSTEM_PROMPT = `You are TravelYu Itinerary Engine, an expert trip planner for Indonesian domestic destinations.

## Core Rules
1. You MUST call save_itinerary with the complete itinerary. Never output JSON as text.
2. Every item needs a realistic est_cost_idr based on actual Indonesian 2026 prices.
3. Balance the day (morning/afternoon/evening) — avoid clustering everything in one slot.
4. Include transport items between locations if they are >2km apart.
5. Dining items must be included at least twice per day.
6. Accommodation must be included on day_number 1 with time_slot 'evening'.

## Indonesian Price Benchmarks (2026)
- Budget hotel/guesthouse: Rp 200.000–500.000/night
- Mid hotel: Rp 500.000–1.500.000/night
- Premium villa: Rp 1.500.000–5.000.000/night
- Local warung meal: Rp 20.000–50.000/person
- Mid restaurant: Rp 50.000–150.000/person
- Premium restaurant: Rp 150.000–500.000/person
- Local attraction: Rp 15.000–75.000/person
- Premium experience: Rp 150.000–500.000/person
- Grab/taxi short trip: Rp 25.000–80.000
- Fast boat between islands: Rp 150.000–350.000
- Domestic flight (Jakarta to Bali): Rp 500.000–1.500.000/person

## Itinerary Structure
- Day 1: Arrival + check-in + welcome dinner + easy orientation activity
- Middle days: Core attractions + experiences + local food discovery
- Last day: Morning activity + checkout + departure transport
- Mix activity types: never 3 attractions in a row; break with dining or rest
- Include at least 1 hidden gem (non-touristy spot) per trip
- Pacing: slow=max 2 activities/day, balanced=3-4/day, packed=5-6/day

## Data Priority
1. Use VERIFIED VENDORS from the context below by exact name (set source='internal_db')
2. For gaps, generate realistic Indonesian venue names (set source='web_search')`;

    const basePrompt = `Trip ID: ${body.tripId}
Today in Jakarta: ${todayJakarta}
Intake data: ${sanitizeForPrompt(intakeData as Record<string, unknown>)}
Selected comparison option: ${comparisonOption}
Selected option details: ${JSON.stringify(selectedOptionContext)}

VERIFIED VENDORS FOR THIS DESTINATION:
${vendorContext}

Generate a complete itinerary following the comparison option details (destinations, vibe, budget).
Prioritize verified vendors above. Set source='internal_db' for any vendor from the list above.
For items not in the vendor list, set source='web_search'.
IMPORTANT: You MUST call the save_itinerary tool with complete itinerary before finishing.
`;

    const result = await generateText({
      model,
      maxRetries: 2,
      abortSignal: controller.signal,
      toolChoice: { type: "tool", toolName: "save_itinerary" },
      system: GENERATION_SYSTEM_PROMPT,
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
      console.log(`[generate-trip] Primary save failed, attempting fallback for trip ${body.tripId}`);
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
      "locationLat": 0,
      "locationLng": 0,
      "bookingUrl": "https://...",
      "source": "internal_db|web_search|provider_api|manual_cs"
    }
  ]
}`,
      });

      const fallbackPayload = parseFallbackItinerary(fallback.text);
      if (fallbackPayload) {
        const normalizedFallbackPayload: z.infer<typeof itineraryPayloadSchema> = {
          ...fallbackPayload,
          items: fallbackPayload.items.map((item) => ({
            ...item,
            bookingUrl:
              ensureValidHttpUrl(item.bookingUrl) ??
              fallbackMapsUrl({
                title: item.title,
                locationAddress: item.locationAddress,
                locationLat: item.locationLat,
                locationLng: item.locationLng,
              }) ??
              undefined,
          })),
        };

        const fallbackSavedResult = await persistGeneratedItinerary(normalizedFallbackPayload);
        if (fallbackSavedResult.ok && fallbackSavedResult.itemCount > 0) {
          saveItineraryResult = fallbackSavedResult;
        }
      } else {
        console.error("[generate-trip] Fallback JSON parse failed");
      }
    }

    clearTimeout(timeoutId);
    console.log(`[generate-trip] Generation completed for trip ${body.tripId}, result: ${saveItineraryResult?.ok ? 'success' : 'failed'}`);

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
