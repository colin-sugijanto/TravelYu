import { generateObject } from "ai";
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

type VendorSeed = {
  name: string;
  city: string;
  activityType: (typeof ACTIVITY_TYPES)[number] | null;
  priceTier: "budget" | "mid" | "premium";
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

    const titleRaw = rawItem.title ?? rawItem.name ?? rawItem.activity;
    const title = typeof titleRaw === "string" && titleRaw.trim().length > 0 ? titleRaw.trim() : `Aktivitas Day ${day}`;

    const descriptionRaw = rawItem.description ?? rawItem.notes;
    const description =
      typeof descriptionRaw === "string" && descriptionRaw.trim().length > 0
        ? descriptionRaw.trim()
        : `Rencana ${title}`;

    const estCostRaw = toNumber(rawItem.estCostIdr ?? rawItem.est_cost_idr ?? rawItem.estimated_cost_idr);
    const estCostIdr = Math.max(0, Math.floor(estCostRaw ?? 0));

    const locationAddressRaw =
      rawItem.locationAddress ?? rawItem.location_address ?? rawItem.address ?? rawItem.vendor_name;
    const locationAddress =
      typeof locationAddressRaw === "string" && locationAddressRaw.trim().length > 0
        ? locationAddressRaw.trim()
        : undefined;

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

function parseBudgetIdrFromIntake(intakeData: Record<string, unknown>): number | null {
  const raw = typeof intakeData.budget === "string" ? intakeData.budget.toLowerCase() : "";
  if (!raw) return null;

  const match = raw.match(/(\d+(?:[.,]\d+)*)\s*(juta|jt|m|ribu|rb|k)?/i);
  if (!match) return null;

  const parsed = Number(match[1].replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  const suffix = (match[2] ?? "").toLowerCase();
  if (suffix === "juta" || suffix === "jt" || suffix === "m") return Math.round(parsed * 1_000_000);
  if (suffix === "ribu" || suffix === "rb" || suffix === "k") return Math.round(parsed * 1_000);
  return Math.round(parsed);
}

function normalizeVendorActivityType(value: unknown): (typeof ACTIVITY_TYPES)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();

  if (normalized === "hotel" || normalized === "villa" || normalized === "accommodation") return "accommodation";
  if (normalized === "restaurant" || normalized === "dining" || normalized === "cafe") return "dining";
  if (normalized === "transport") return "transport";
  if (normalized === "attraction") return "attraction";
  if (normalized === "experience" || normalized === "guide") return "experience";
  return null;
}

function normalizePriceTier(value: unknown): "budget" | "mid" | "premium" {
  if (typeof value !== "string") return "mid";
  const normalized = value.trim().toLowerCase();
  if (normalized === "budget" || normalized === "mid" || normalized === "premium") {
    return normalized;
  }
  return "mid";
}

function normalizeVendorSeeds(input: unknown): VendorSeed[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((row) => {
      if (!isRecord(row)) return null;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return null;
      const city = typeof row.city === "string" ? row.city.trim() : "";

      return {
        name,
        city,
        activityType: normalizeVendorActivityType(row.type),
        priceTier: normalizePriceTier(row.price_tier),
      } satisfies VendorSeed;
    })
    .filter((row): row is VendorSeed => row !== null);
}

function roundToNearest(value: number, step = 50_000) {
  return Math.max(0, Math.round(value / step) * step);
}

function costFromType(
  activityType: (typeof ACTIVITY_TYPES)[number],
  priceTier: "budget" | "mid" | "premium",
  multiplier: number,
) {
  const base: Record<(typeof ACTIVITY_TYPES)[number], number> = {
    accommodation: 900_000,
    transport: 220_000,
    dining: 180_000,
    attraction: 200_000,
    experience: 350_000,
    rest: 0,
  };

  const tierMultiplier = priceTier === "budget" ? 0.85 : priceTier === "premium" ? 1.35 : 1;
  return roundToNearest(base[activityType] * tierMultiplier * multiplier);
}

function pickByDay<T>(items: T[], day: number, salt: number): T | null {
  if (items.length < 1) return null;
  const index = Math.abs(day * 31 + salt * 17) % items.length;
  return items[index] ?? null;
}

function isLowQualityGeneratedItinerary(generated: z.infer<typeof generatedItinerarySchema>): boolean {
  if (generated.items.length < 1) return true;

  const placeholderTitleRegex = /^aktivitas day\s+\d+$/i;
  const placeholderDescRegex = /^rencana aktivitas day\s+\d+/i;

  const placeholderCount = generated.items.filter((item) => {
    const title = item.title.trim();
    const desc = item.description.trim();
    return placeholderTitleRegex.test(title) || placeholderDescRegex.test(desc);
  }).length;

  const meaningfulTitles = new Set(
    generated.items
      .map((item) => item.title.trim().toLowerCase())
      .filter((title) => title.length > 0 && !placeholderTitleRegex.test(title)),
  );

  const placeholderRatio = placeholderCount / generated.items.length;
  if (placeholderRatio >= 0.2) return true;
  if (meaningfulTitles.size < Math.max(4, Math.floor(generated.items.length * 0.35))) return true;

  return false;
}

function buildReliableFallbackItinerary(input: {
  targetDays: number;
  destinationCity: string;
  intakeData: Record<string, unknown>;
  selectedOption: ComparisonSummary;
  vendors: VendorSeed[];
}): z.infer<typeof generatedItinerarySchema> {
  const targetDays = Math.max(2, Math.min(10, Math.floor(input.targetDays)));
  const destination = input.destinationCity || "Bali";

  const optionMultiplier = input.selectedOption.title?.toLowerCase().includes("premium")
    ? 1.2
    : input.selectedOption.title?.toLowerCase().includes("budget")
      ? 0.85
      : 1;

  const budgetFromOption =
    typeof input.selectedOption.estimatedBudgetIdr === "number" && Number.isFinite(input.selectedOption.estimatedBudgetIdr)
      ? input.selectedOption.estimatedBudgetIdr
      : null;
  const budgetFromIntake = parseBudgetIdrFromIntake(input.intakeData);
  const targetBudget = budgetFromOption ?? budgetFromIntake;

  const baselineDaily = 1_700_000;
  const budgetScale = targetBudget
    ? Math.max(0.65, Math.min(1.45, targetBudget / Math.max(targetDays * baselineDaily, 1)))
    : 1;

  const multiplier = optionMultiplier * budgetScale;

  const accommodationPool = input.vendors.filter((v) => v.activityType === "accommodation");
  const diningPool = input.vendors.filter((v) => v.activityType === "dining");
  const experiencePool = input.vendors.filter((v) => v.activityType === "experience" || v.activityType === "attraction");

  const items: z.infer<typeof generatedItinerarySchema>["items"] = [];

  for (let day = 1; day <= targetDays; day += 1) {
    const breakfastSpot = pickByDay(diningPool, day, 1);
    items.push({
      day,
      timeSlot: "morning",
      activityType: "dining",
      title: breakfastSpot ? `Sarapan di ${breakfastSpot.name}` : `Sarapan lokal khas ${destination}`,
      description: breakfastSpot
        ? `Mulai hari dengan sarapan santai di ${breakfastSpot.name} sebelum eksplorasi.`
        : `Nikmati sarapan lokal untuk energi sebelum aktivitas utama.`,
      estCostIdr: costFromType("dining", breakfastSpot?.priceTier ?? "mid", multiplier),
      locationAddress: breakfastSpot?.city || destination,
      source: breakfastSpot ? "internal_db" : "web_search",
    });

    if (day === 1) {
      items.push({
        day,
        timeSlot: "afternoon",
        activityType: "transport",
        title: `Transfer kedatangan menuju area ${destination}`,
        description: `Perjalanan dari titik kedatangan ke akomodasi dengan rute paling efisien.`,
        estCostIdr: costFromType("transport", "mid", multiplier),
        locationAddress: destination,
        source: "web_search",
      });
    } else if (day === targetDays) {
      items.push({
        day,
        timeSlot: "afternoon",
        activityType: "transport",
        title: `Transfer pulang dari ${destination}`,
        description: `Persiapan check-out dan transfer menuju titik keberangkatan.`,
        estCostIdr: costFromType("transport", "mid", multiplier),
        locationAddress: destination,
        source: "web_search",
      });
    } else {
      const spot = pickByDay(experiencePool, day, 3);
      const activityType = spot?.activityType === "attraction" ? "attraction" : "experience";
      items.push({
        day,
        timeSlot: "afternoon",
        activityType,
        title: spot ? `Eksplor ${spot.name}` : `Eksplorasi budaya & hidden gem ${destination}`,
        description: spot
          ? `Sesi eksplorasi utama hari ini di ${spot.name} dengan ritme santai.`
          : `Kunjungi area ikonik dan spot lokal non-turis untuk pengalaman autentik.`,
        estCostIdr: costFromType(activityType, spot?.priceTier ?? "mid", multiplier),
        locationAddress: spot?.city || destination,
        source: spot ? "internal_db" : "web_search",
      });
    }

    if (day === 1) {
      const stay = pickByDay(accommodationPool, day, 5);
      items.push({
        day,
        timeSlot: "evening",
        activityType: "accommodation",
        title: stay ? `Check-in ${stay.name}` : `Check-in akomodasi nyaman di ${destination}`,
        description: stay
          ? `Check-in dan istirahat sejenak di ${stay.name} sebelum aktivitas malam.`
          : `Check-in di akomodasi terpilih dengan akses mudah ke pusat aktivitas.`,
        estCostIdr: costFromType("accommodation", stay?.priceTier ?? "mid", multiplier),
        locationAddress: stay?.city || destination,
        source: stay ? "internal_db" : "web_search",
      });
    } else {
      const dinnerSpot = pickByDay(diningPool, day, 7);
      items.push({
        day,
        timeSlot: "evening",
        activityType: "dining",
        title: dinnerSpot ? `Makan malam di ${dinnerSpot.name}` : `Makan malam khas ${destination}`,
        description: dinnerSpot
          ? `Penutup hari dengan kuliner lokal di ${dinnerSpot.name}.`
          : `Cicipi menu khas daerah sebagai penutup hari eksplorasi.`,
        estCostIdr: costFromType("dining", dinnerSpot?.priceTier ?? "mid", multiplier * 1.1),
        locationAddress: dinnerSpot?.city || destination,
        source: dinnerSpot ? "internal_db" : "web_search",
      });
    }

    items.push({
      day,
      timeSlot: "night",
      activityType: "rest",
      title: `Istirahat malam di ${destination}`,
      description:
        day === targetDays
          ? "Waktu istirahat setelah aktivitas terakhir sebelum kembali pulang."
          : "Istirahat untuk recovery sebelum melanjutkan itinerary esok hari.",
      estCostIdr: 0,
      locationAddress: destination,
      source: "web_search",
    });
  }

  const totalEstCostIdr = items.reduce((sum, item) => sum + item.estCostIdr, 0);
  return {
    totalEstCostIdr,
    items,
  };
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

  const normalizedVendors = normalizeVendorSeeds(relevantVendors);

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
        const primary = await generateObject({
          model,
          maxRetries: 1,
          abortSignal: controller.signal,
          system: GENERATION_SYSTEM_PROMPT,
          prompt: basePrompt,
          schema: generatedItinerarySchema,
        });
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
            const fallback = await generateObject({
              model,
              maxRetries: 0,
              abortSignal: controller.signal,
              system: COMPACT_SYSTEM_PROMPT,
              prompt: compactPrompt,
              schema: generatedItinerarySchema,
            });
            generated = fallback.object;
          } catch (fallbackError) {
            const recoveredFromFallback = recoverGeneratedItineraryFromError(fallbackError);
            if (!recoveredFromFallback) {
              throw fallbackError;
            }

            console.warn(
              `[generate-trip] Recovered schema-mismatched compact response for trip ${body.tripId}; proceeding with normalized payload.`,
            );
            generated = recoveredFromFallback;
          }
        }
      }

      if (isLowQualityGeneratedItinerary(generated)) {
        console.warn(
          `[generate-trip] Low-quality schema recovery detected for trip ${body.tripId}. Switching to deterministic fallback itinerary builder.`,
        );
        generated = buildReliableFallbackItinerary({
          targetDays,
          destinationCity,
          intakeData,
          selectedOption: selectedSummary,
          vendors: normalizedVendors,
        });
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

    const fallbackGenerated = buildReliableFallbackItinerary({
      targetDays: inferTripDaysForPrompt(intakeData),
      destinationCity,
      intakeData,
      selectedOption: selectedSummary,
      vendors: normalizedVendors,
    });

    const fallbackSaveResult = await persistGeneratedItinerary(toPersistPayload(body.tripId, fallbackGenerated));
    if (fallbackSaveResult.ok && fallbackSaveResult.itemCount > 0) {
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
        fallback: true,
        message: "Itinerary generated successfully",
      });
    }

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
