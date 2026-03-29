import { generateObject, generateText } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { getCurrentAppUser } from "@/lib/auth";
import { model } from "@/lib/ai/openrouter";
import { parseAiProviderError } from "@/lib/ai/errors";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateRequest, generateTripSchema } from "@/lib/validators";
import { validateItinerary } from "@/lib/ai/validate-itinerary";
import { parseTripDateRangeFromWhen, toIsoDateOnly } from "@/lib/trip-dates";

export const maxDuration = 300;

const LOCAL_TIMEOUT_MS = 600_000;
const VERCEL_TIMEOUT_MS = 240_000;
const GENERATE_OBJECT_ATTEMPT_TIMEOUT_MS = 60_000;

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

function inferTripDaysForPrompt(intakeData: Record<string, unknown>) {
  const whenText = typeof intakeData.when === "string" ? intakeData.when : undefined;
  const parsedRange = parseTripDateRangeFromWhen(whenText);

  if (parsedRange) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays =
      Math.floor((parsedRange.endDate.getTime() - parsedRange.startDate.getTime()) / msPerDay) + 1;
    return Math.min(10, Math.max(2, Math.floor(diffDays)));
  }

  return 4;
}

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

const generatedItinerarySchema = itineraryPayloadSchema.omit({ tripId: true });

const TIME_SLOTS = ["morning", "afternoon", "evening", "night"] as const;
const ACTIVITY_TYPES = ["accommodation", "transport", "dining", "attraction", "experience", "rest"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[,_\s]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeTimeSlot(value: unknown): (typeof TIME_SLOTS)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (TIME_SLOTS.includes(normalized as (typeof TIME_SLOTS)[number])) {
    return normalized as (typeof TIME_SLOTS)[number];
  }

  if (normalized.includes("morning") || normalized.includes("pagi")) return "morning";
  if (normalized.includes("afternoon") || normalized.includes("siang")) return "afternoon";
  if (normalized.includes("evening") || normalized.includes("sore")) return "evening";
  if (normalized.includes("night") || normalized.includes("malam")) return "night";

  return null;
}

function normalizeActivityType(value: unknown): (typeof ACTIVITY_TYPES)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (ACTIVITY_TYPES.includes(normalized as (typeof ACTIVITY_TYPES)[number])) {
    return normalized as (typeof ACTIVITY_TYPES)[number];
  }

  if (normalized === "hotel" || normalized === "stay") return "accommodation";
  if (normalized === "flight" || normalized === "taxi" || normalized === "transfer") return "transport";
  if (normalized === "food" || normalized === "meal" || normalized === "restaurant") return "dining";
  if (normalized === "event" || normalized === "activity" || normalized === "tour") return "experience";

  return null;
}

function normalizeRecoveredGeneratedItinerary(input: unknown): z.infer<typeof generatedItinerarySchema> | null {
  const direct = generatedItinerarySchema.safeParse(input);
  if (direct.success) return direct.data;
  if (!isRecord(input)) return null;

  const flattenedItems: unknown[] = [];

  if (Array.isArray(input.items)) {
    flattenedItems.push(...input.items);
  }

  if (Array.isArray(input.days)) {
    for (const dayEntry of input.days) {
      if (!isRecord(dayEntry) || !Array.isArray(dayEntry.items)) continue;

      const dayNumber = toNumber(dayEntry.day_number ?? dayEntry.day);
      for (const rawItem of dayEntry.items) {
        if (!isRecord(rawItem)) continue;
        flattenedItems.push({
          ...rawItem,
          day: rawItem.day ?? rawItem.day_number ?? dayNumber,
        });
      }
    }
  }

  if (flattenedItems.length < 1) return null;

  const normalizedItems: Array<Record<string, unknown>> = [];

  flattenedItems.forEach((rawItem, index) => {
    if (!isRecord(rawItem)) return;

    const dayCandidate = toNumber(rawItem.day ?? rawItem.day_number);
    const day = dayCandidate ? Math.max(1, Math.floor(dayCandidate)) : Math.max(1, Math.floor(index / 4) + 1);

    const timeSlot =
      normalizeTimeSlot(rawItem.timeSlot ?? rawItem.time_slot) ??
      TIME_SLOTS[index % TIME_SLOTS.length];

    const activityType =
      normalizeActivityType(rawItem.activityType ?? rawItem.activity_type ?? rawItem.type) ??
      (timeSlot === "night" ? "rest" : "experience");

    const locationAddressRaw =
      rawItem.locationAddress ??
      rawItem.location_address ??
      rawItem.address ??
      rawItem.vendor_name ??
      rawItem.location_name ??
      rawItem.place ??
      rawItem.venue;
    const locationAddress =
      typeof locationAddressRaw === "string" && locationAddressRaw.trim().length > 0
        ? locationAddressRaw.trim()
        : undefined;

    const titleRaw =
      rawItem.title ??
      rawItem.name ??
      rawItem.activity ??
      rawItem.activity_name ??
      rawItem.activityTitle ??
      rawItem.place ??
      rawItem.venue ??
      rawItem.location_name;
    const title =
      typeof titleRaw === "string" && titleRaw.trim().length > 0
        ? titleRaw.trim()
        : locationAddress ?? `Day ${day} Activity`;

    const descriptionRaw = rawItem.description ?? rawItem.notes ?? rawItem.detail ?? rawItem.summary;
    const description =
      typeof descriptionRaw === "string" && descriptionRaw.trim().length > 0
        ? descriptionRaw.trim()
        : `Aktivitas terjadwal: ${title}`;

    const estCostRaw = toNumber(rawItem.estCostIdr ?? rawItem.est_cost_idr ?? rawItem.estimated_cost_idr);
    const estCostIdr = Math.max(0, Math.floor(estCostRaw ?? 0));

    const locationLatRaw = toNumber(rawItem.locationLat ?? rawItem.location_lat ?? rawItem.lat ?? rawItem.latitude);
    const locationLngRaw = toNumber(rawItem.locationLng ?? rawItem.location_lng ?? rawItem.lng ?? rawItem.longitude);

    const locationLat = locationLatRaw !== null ? locationLatRaw : undefined;
    const locationLng = locationLngRaw !== null ? locationLngRaw : undefined;

    const bookingUrlRaw =
      (typeof rawItem.bookingUrl === "string" ? rawItem.bookingUrl : undefined) ??
      (typeof rawItem.booking_url === "string" ? rawItem.booking_url : undefined);
    const bookingUrl = ensureValidHttpUrl(bookingUrlRaw) ?? undefined;

    const sourceRaw = typeof rawItem.source === "string" ? rawItem.source : "";
    const source: "internal_db" | "web_search" | "provider_api" | "manual_cs" =
      sourceRaw === "internal_db" ||
      sourceRaw === "web_search" ||
      sourceRaw === "provider_api" ||
      sourceRaw === "manual_cs"
        ? sourceRaw
        : "web_search";

    normalizedItems.push({
      day,
      timeSlot,
      activityType,
      title,
      description,
      estCostIdr,
      locationAddress,
      locationLat,
      locationLng,
      bookingUrl,
      source,
    });
  });

  if (normalizedItems.length < 1) return null;

  const totalCostCandidate = toNumber(input.totalEstCostIdr ?? input.total_estimated_cost_idr ?? input.totalCostIdr);
  const sumCosts = normalizedItems.reduce((acc, item) => {
    const value = toNumber(item.estCostIdr);
    return acc + Math.max(0, Math.floor(value ?? 0));
  }, 0);

  const candidate = {
    totalEstCostIdr: Math.max(0, Math.floor(totalCostCandidate ?? sumCosts)),
    items: normalizedItems,
  };

  const parsed = generatedItinerarySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function extractObjectFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function isRateLimitedError(error: unknown): boolean {
  if (!isRecord(error)) return false;

  const statusCode = typeof error.statusCode === "number" ? error.statusCode : undefined;
  if (statusCode === 429) return true;

  const responseBody = typeof error.responseBody === "string" ? error.responseBody.toLowerCase() : "";
  if (
    responseBody.includes('"code":429') ||
    responseBody.includes("too many requests") ||
    responseBody.includes("rate-limited") ||
    responseBody.includes("rate limit")
  ) {
    return true;
  }

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (message.includes("429") || message.includes("too many requests") || message.includes("rate-limited") || message.includes("rate limit")) {
    return true;
  }

  if (Array.isArray(error.errors)) {
    for (const nested of error.errors) {
      if (isRateLimitedError(nested)) return true;
    }
  }

  if (isRecord(error.lastError) && isRateLimitedError(error.lastError)) {
    return true;
  }

  if (isRecord(error.cause) && isRateLimitedError(error.cause)) {
    return true;
  }

  return false;
}

function recoverGeneratedItineraryFromError(error: unknown): z.infer<typeof generatedItinerarySchema> | null {
  const candidates: unknown[] = [];

  if (isRecord(error)) {
    if ("value" in error) candidates.push(error.value);

    if (typeof error.text === "string") {
      const parsedFromText = extractObjectFromText(error.text);
      if (parsedFromText !== null) candidates.push(parsedFromText);
    }

    if (isRecord(error.cause)) {
      if ("value" in error.cause) candidates.push(error.cause.value);

      if (typeof error.cause.text === "string") {
        const parsedFromCauseText = extractObjectFromText(error.cause.text);
        if (parsedFromCauseText !== null) candidates.push(parsedFromCauseText);
      }
    }
  }

  for (const candidate of candidates) {
    const recovered = normalizeRecoveredGeneratedItinerary(candidate);
    if (recovered) return recovered;
  }

  return null;
}

function toPersistPayload(
  tripId: string,
  generated: z.infer<typeof generatedItinerarySchema>,
): z.infer<typeof itineraryPayloadSchema> {
  return {
    tripId,
    totalEstCostIdr: generated.totalEstCostIdr,
    items: generated.items.map((item) => ({
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
}

function hasGenericPlaceholderContent(items: Array<{ title: string; description: string }>): boolean {
  if (items.length < 1) return true;

  const placeholderTitleRegex = /^aktivitas day\s+\d+$/i;
  const placeholderDescRegex = /^rencana aktivitas day\s+\d+/i;
  const genericDayRegex = /^day\s+\d+\s+activity$/i;

  const placeholderCount = items.filter((item) => {
    const title = item.title.trim();
    const description = item.description.trim();
    return (
      placeholderTitleRegex.test(title) ||
      placeholderDescRegex.test(description) ||
      genericDayRegex.test(title)
    );
  }).length;

  return placeholderCount >= Math.ceil(items.length * 0.35);
}

function extractJsonCandidateFromText(text: string): unknown {
  const direct = extractObjectFromText(text);
  if (direct !== null) return direct;

  const fencedBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fencedMatch: RegExpExecArray | null;
  while ((fencedMatch = fencedBlockRegex.exec(text)) !== null) {
    const candidate = extractObjectFromText(fencedMatch[1] ?? "");
    if (candidate !== null) return candidate;
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = extractObjectFromText(text.slice(firstBrace, lastBrace + 1));
    if (candidate !== null) return candidate;
  }

  return null;
}

async function runWithHardTimeout<T>(
  label: string,
  run: () => Promise<T>,
  abort: () => void,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const hardTimeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        abort();
        reject(new Error(`[generate-trip] ${label} exceeded ${GENERATE_OBJECT_ATTEMPT_TIMEOUT_MS}ms`));
      }, GENERATE_OBJECT_ATTEMPT_TIMEOUT_MS);
    });

    return await Promise.race([run(), hardTimeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

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

export async function POST(request: Request) {
  let saveItineraryResult: SaveItineraryResult | null = null;

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await checkAiRateLimit(appUser.id, "generate-trip");
  if (blocked) {
    return blocked;
  }

  const useGoogleAiStudio = (process.env.USE_GOOGLE_AI_STUDIO ?? "false").toLowerCase() === "true";
  const hasOpenRouter = typeof process.env.OPENROUTER_API_KEY === "string" && process.env.OPENROUTER_API_KEY.trim().length > 0;
  const hasGoogleAiStudio =
    typeof process.env.GOOGLE_AI_STUDIO_API_KEY === "string" && process.env.GOOGLE_AI_STUDIO_API_KEY.trim().length > 0;

  if ((!hasOpenRouter && !hasGoogleAiStudio) || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "AI itinerary generation service is not configured" }, { status: 503 });
  }

  if (useGoogleAiStudio && !hasGoogleAiStudio) {
    return Response.json({ error: "Google AI Studio is enabled but API key is missing" }, { status: 503 });
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
          .slice(0, 12)
          .map(
            (v) =>
              `[${String(v.type).toUpperCase()}] ${
                v.name
              } | ${v.city} | ${v.price_tier} | ${Number(v.avg_rating).toFixed(1)}★ | ${Array.isArray(v.tags) ? (v.tags as string[]).join(", ") : ""}`,
          )
          .join("\n")
      : "No pre-seeded vendors found for this destination — generate realistic Indonesian venue names.";

  try {
    const timeoutMs = process.env.VERCEL ? VERCEL_TIMEOUT_MS : LOCAL_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[generate-trip] Timeout reached for trip ${body.tripId}, aborting...`);
      controller.abort();
    }, timeoutMs);

    try {
      console.log(
        `[generate-trip] Starting generation for trip ${body.tripId} with ${(timeoutMs / 1000).toFixed(0)}s timeout`,
      );

      const todayJakarta = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date());

      const targetDays = inferTripDaysForPrompt(intakeData);

      const GENERATION_SYSTEM_PROMPT = `You are TravelYu Itinerary Engine, an expert trip planner for Indonesian domestic destinations.

## Core Rules
1. You MUST return structured itinerary data that matches the provided schema.
2. Output MUST be a single JSON object with ONLY top-level keys: totalEstCostIdr (number) and items (array).
3. Do NOT use alternative keys like trip_id, total_estimated_cost_idr, day_number, or days.
4. Every item needs a realistic est_cost_idr based on actual Indonesian 2026 prices.
5. Balance the day (morning/afternoon/evening) — avoid clustering everything in one slot.
6. Include transport items between locations if they are >2km apart.
7. Dining items must be included at least twice per day.
8. Accommodation must be included on day_number 1 with time_slot 'evening'.

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
Target trip duration: ${targetDays} days

VERIFIED VENDORS FOR THIS DESTINATION:
${vendorContext}

Generate a complete itinerary following the comparison option details (destinations, vibe, budget).
Use day numbers from 1 to ${targetDays}. Cover each day with balanced timeslots.
Prioritize verified vendors above. Set source='internal_db' for any vendor from the list above.
For items not in the vendor list, set source='web_search'.
`;

      let generated: z.infer<typeof generatedItinerarySchema>;
      try {
          const primary = await runWithHardTimeout(
            "primary generation",
            () =>
              generateObject({
                model,
                maxRetries: 1,
                abortSignal: controller.signal,
                system: GENERATION_SYSTEM_PROMPT,
                prompt: basePrompt,
                schema: generatedItinerarySchema,
              }),
            () => controller.abort(),
          );
          generated = primary.object;
      } catch (primaryError) {
        const recoveredFromPrimary = recoverGeneratedItineraryFromError(primaryError);
        if (recoveredFromPrimary) {
          console.warn(
            `[generate-trip] Recovered schema-mismatched primary response for trip ${body.tripId}; continuing without compact retry.`,
          );
          generated = recoveredFromPrimary;
        } else {
          if (isRateLimitedError(primaryError)) {
            throw primaryError;
          }

          console.warn(`[generate-trip] Primary AI generation failed for trip ${body.tripId}. Retrying with compact prompt.`, primaryError);

          const COMPACT_SYSTEM_PROMPT = `Generate practical Indonesian trip itineraries in valid structured output.
Rules:
- Return one JSON object with top-level keys EXACTLY: totalEstCostIdr and items.
- Do not return days array, trip_id, or snake_case top-level keys.
- Exactly ${targetDays} days.
- Include one item per timeslot (morning, afternoon, evening, night) each day.
- Day 1 evening must be accommodation.
- Include dining at least in afternoon and night every day.
- Use realistic 2026 IDR prices and keep descriptions concise.`;

          const compactPrompt = `Trip ID: ${body.tripId}
Intake: ${sanitizeForPrompt(intakeData as Record<string, unknown>)}
Chosen option: ${JSON.stringify(selectedOptionContext)}
Destination vendors:\n${vendorContext}`;

          try {
            const fallback = await runWithHardTimeout(
              "compact generation",
              () =>
                generateObject({
                  model,
                  maxRetries: 0,
                  abortSignal: controller.signal,
                  system: COMPACT_SYSTEM_PROMPT,
                  prompt: compactPrompt,
                  schema: generatedItinerarySchema,
                }),
              () => controller.abort(),
            );
            generated = fallback.object;
          } catch (fallbackError) {
            const recoveredFromFallback = recoverGeneratedItineraryFromError(fallbackError);
            if (recoveredFromFallback) {
              console.warn(
                `[generate-trip] Recovered schema-mismatched compact response for trip ${body.tripId}; proceeding with normalized payload.`,
              );
              generated = recoveredFromFallback;
            } else {
              console.warn(
                `[generate-trip] Compact generation failed for trip ${body.tripId}. Retrying with text JSON fallback.`,
                fallbackError,
              );

              const textFallbackSystemPrompt = `Generate Indonesian travel itinerary in strict JSON only.
Rules:
- Output exactly one JSON object.
- Top-level keys must be: totalEstCostIdr, items.
- items is array of objects with keys:
  day, timeSlot, activityType, title, description, estCostIdr, locationAddress, source.
- timeSlot must be one of: morning, afternoon, evening, night.
- activityType must be one of: accommodation, transport, dining, attraction, experience, rest.
- Use concrete places/activities in Indonesia and realistic 2026 IDR prices.
- Never use generic placeholders like Aktivitas Day X.`;

              const textFallbackPrompt = `Trip ID: ${body.tripId}
Intake data: ${sanitizeForPrompt(intakeData as Record<string, unknown>)}
Selected option details: ${JSON.stringify(selectedOptionContext)}
Target trip duration: ${targetDays} days
Verified vendors (if available):
${vendorContext}`;

              const textFallback = await runWithHardTimeout(
                "text json fallback generation",
                () =>
                  generateText({
                    model,
                    maxRetries: 0,
                    abortSignal: controller.signal,
                    system: textFallbackSystemPrompt,
                    prompt: textFallbackPrompt,
                  }),
                () => controller.abort(),
              );

              const parsedFromText = extractJsonCandidateFromText(textFallback.text);
              const normalizedFromText = normalizeRecoveredGeneratedItinerary(parsedFromText);
              if (!normalizedFromText) {
                throw fallbackError;
              }

              generated = normalizedFromText;
            }
          }
        }
      }

      if (generated.items.length > 0) {
        if (hasGenericPlaceholderContent(generated.items)) {
          const retryPrompt = `${basePrompt}\n\nIMPORTANT QUALITY GUARDRAIL:\n- Never use generic placeholders like \"Aktivitas Day X\" or \"Rencana Aktivitas Day X\".\n- Every title must be specific to a real place, venue, or activity in Indonesia.\n- Every description must mention concrete details for that activity.`;

          try {
            const retry = await runWithHardTimeout(
              "quality retry generation",
              () =>
                generateObject({
                  model,
                  maxRetries: 0,
                  abortSignal: controller.signal,
                  system: GENERATION_SYSTEM_PROMPT,
                  prompt: retryPrompt,
                  schema: generatedItinerarySchema,
                }),
              () => controller.abort(),
            );

            generated = retry.object;
          } catch (retryError) {
            const recoveredRetry = recoverGeneratedItineraryFromError(retryError);
            if (recoveredRetry && !hasGenericPlaceholderContent(recoveredRetry.items)) {
              generated = recoveredRetry;
            }
          }
        }

        if (hasGenericPlaceholderContent(generated.items)) {
          const textRegenerationSystemPrompt = `Generate Indonesian travel itinerary in strict JSON only.
Rules:
- Output exactly one JSON object.
- Top-level keys: totalEstCostIdr, items.
- Items must include concrete places/activities in Indonesia; no placeholders.
- Forbidden patterns in title/description: "Aktivitas Day", "Rencana Aktivitas Day", "Day X Activity".
- Keep realistic 2026 IDR pricing and practical sequencing.`;

          const textRegenerationPrompt = `Trip ID: ${body.tripId}
Intake data: ${sanitizeForPrompt(intakeData as Record<string, unknown>)}
Selected option details: ${JSON.stringify(selectedOptionContext)}
Target trip duration: ${targetDays} days
Verified vendors:
${vendorContext}`;

          try {
            const textRetry = await runWithHardTimeout(
              "placeholder text regeneration",
              () =>
                generateText({
                  model,
                  maxRetries: 0,
                  abortSignal: controller.signal,
                  system: textRegenerationSystemPrompt,
                  prompt: textRegenerationPrompt,
                }),
              () => controller.abort(),
            );

            const parsedRetryText = extractJsonCandidateFromText(textRetry.text);
            const normalizedRetryText = normalizeRecoveredGeneratedItinerary(parsedRetryText);
            if (normalizedRetryText && !hasGenericPlaceholderContent(normalizedRetryText.items)) {
              generated = normalizedRetryText;
            }
          } catch {
            // Fall through to final guardrail below.
          }
        }

        if (hasGenericPlaceholderContent(generated.items)) {
          const rewriteSystemPrompt = `You are refining a generated itinerary JSON.
Rewrite ONLY generic placeholder titles/descriptions into specific, realistic Indonesia trip activities.

Hard constraints:
- Return one JSON object with keys: totalEstCostIdr, items.
- Keep each item's day, timeSlot, activityType, estCostIdr, and location fields intact when possible.
- Replace placeholders such as "Aktivitas Day X", "Rencana Aktivitas Day X", "Day X Activity".
- Use concrete places/activities and concise natural descriptions.
- No markdown, no prose, JSON only.`;

          const rewritePrompt = `Trip ID: ${body.tripId}
Context: ${JSON.stringify(selectedOptionContext)}
Duration: ${targetDays} days

Current generated itinerary JSON:
${JSON.stringify(generated)}`;

          try {
            const rewritten = await runWithHardTimeout(
              "placeholder rewrite generation",
              () =>
                generateObject({
                  model,
                  maxRetries: 0,
                  abortSignal: controller.signal,
                  system: rewriteSystemPrompt,
                  prompt: rewritePrompt,
                  schema: generatedItinerarySchema,
                }),
              () => controller.abort(),
            );

            if (!hasGenericPlaceholderContent(rewritten.object.items)) {
              generated = rewritten.object;
            }
          } catch {
            // Final guardrail below will handle unresolved placeholder output.
          }
        }

        if (hasGenericPlaceholderContent(generated.items)) {
          throw new Error("AI returned generic placeholder itinerary content");
        }
      }

      saveItineraryResult = await persistGeneratedItinerary(toPersistPayload(body.tripId, generated));
      console.log(
        `[generate-trip] Generation completed for trip ${body.tripId}, result: ${saveItineraryResult?.ok ? "success" : "failed"}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

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
      message: "Itinerary generated successfully",
    });
  } catch (error) {
    console.error("[generate-trip] Error during generation:", error);

    const isRateLimited = isRateLimitedError(error);
    const isTimeout = error instanceof Error && error.name === "AbortError" && !isRateLimited;
    
    await supabaseAdmin
      .from("trips")
      .update({ 
        status: "intake", 
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.tripId);

    const parsed = parseAiProviderError(error, {
      defaultMessage: isTimeout 
        ? "AI itinerary timeout sebelum selesai. Coba generate ulang." 
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
