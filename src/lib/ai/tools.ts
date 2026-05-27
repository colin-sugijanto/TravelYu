import { generateText } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { model } from "@/lib/ai/openrouter";
import { searchIndonesiaPlaces } from "@/lib/ai/tavily";
import { normalizePhoneToE164, scheduleNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isMajorChange } from "@/lib/utils";

function isServiceConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function extractJsonArray(text: string): string[] | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return null;
      return parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
    } catch {
      return null;
    }
  }
}

export interface ItineraryToolContext {
  tripId: string;
  appUserId: string;
  isAdmin: boolean;
}

function isSameTripScope(context: ItineraryToolContext, tripId: string) {
  return context.tripId === tripId;
}

export function createItineraryTools(context: ItineraryToolContext) {
  return {
    update_itinerary_item: {
    description: "Update minor editable fields for draft/booked_flexible itinerary item by itemId or by day/title match",
    inputSchema: z.object({
      itemId: z.string().optional().refine((val) => !val || (val !== "undefined" && val !== "null" && val.trim().length > 0), {
        message: "itemId must be a valid UUID or omitted",
      }),
      dayNumber: z.number().int().min(1).optional(),
      currentTitle: z.string().min(1).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      tips: z.string().optional(),
      timeSlot: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
    }).refine((value) => Boolean(value.itemId || value.currentTitle), {
      message: "itemId or currentTitle is required",
    }),
    execute: async (input: {
      itemId?: string;
      dayNumber?: number;
      currentTitle?: string;
      title?: string;
      description?: string;
      tips?: string;
      timeSlot?: "morning" | "afternoon" | "evening" | "night";
    }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      let item: { id: string; status: string; trip_id: string } | null = null;

      if (input.itemId) {
        const { data } = await supabaseAdmin
          .from("itinerary_items")
          .select("id,status,trip_id")
          .eq("id", input.itemId)
          .eq("trip_id", context.tripId)
          .maybeSingle();

        if (data) {
          item = data;
        }
      }

      if (!item) {
        let statement = supabaseAdmin
          .from("itinerary_items")
          .select("id,status,trip_id")
          .eq("trip_id", context.tripId);

        if (typeof input.dayNumber === "number") {
          statement = statement.eq("day_number", input.dayNumber);
        }

        const currentTitle = input.currentTitle?.trim();
        if (currentTitle) {
          statement = statement.ilike("title", `%${currentTitle}%`);
        }

        const { data } = await statement.order("sort_order", { ascending: true }).limit(1).maybeSingle();
        if (data) {
          item = data;
        }
      }

      if (!item) return { ok: false, reason: "Item not found" };
      if (item.status === "booked_locked") {
        return { ok: false, reason: "Item is locked; use flag_for_cs_approval" };
      }

      const { error } = await supabaseAdmin
        .from("itinerary_items")
        .update({
          ...(input.title ? { title: input.title } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.tips ? { tips: input.tips } : {}),
          ...(input.timeSlot ? { time_slot: input.timeSlot } : {}),
        })
        .eq("id", item.id);

      if (error) {
        return { ok: false, error: error.message };
      }

      revalidateTag(`trip:${item.trip_id}:items`, "max");
      revalidateTag(`trip:${item.trip_id}`, "max");

      return { ok: true, itemId: item.id };
    },
  },

    add_itinerary_item: {
    description: "Add itinerary item to specific trip day",
    inputSchema: z.object({
      tripId: z.string().optional(),
      dayNumber: z.number().int().min(1),
      timeSlot: z.enum(["morning", "afternoon", "evening", "night"]),
      activityType: z.enum(["accommodation", "transport", "dining", "attraction", "experience", "rest"]),
      title: z.string(),
      description: z.string(),
      estCostIdr: z.number().int().min(0),
    }),
    execute: async (input: {
      tripId?: string;
      dayNumber: number;
      timeSlot: "morning" | "afternoon" | "evening" | "night";
      activityType: "accommodation" | "transport" | "dining" | "attraction" | "experience" | "rest";
      title: string;
      description: string;
      estCostIdr: number;
    }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const resolvedTripId = input.tripId ?? context.tripId;
      if (!isSameTripScope(context, resolvedTripId)) {
        return { ok: false, reason: "Forbidden trip scope" };
      }

      const { error } = await supabaseAdmin.from("itinerary_items").insert({
        trip_id: resolvedTripId,
        day_number: input.dayNumber,
        time_slot: input.timeSlot,
        sort_order: 99,
        activity_type: input.activityType,
        title: input.title,
        description: input.description,
        est_cost_idr: input.estCostIdr,
        status: "draft",
        source: "manual_cs",
      });

      if (!error) {
        revalidateTag(`trip:${resolvedTripId}:items`, "max");
        revalidateTag(`trip:${resolvedTripId}`, "max");
      }

      return { ok: !error, error: error?.message };
    },
  },

    delete_itinerary_item: {
    description: "Delete draft/flexible itinerary item or flag locked item for CS",
    inputSchema: z.object({
      itemId: z.string(),
    }),
    execute: async ({ itemId }: { itemId: string }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const { data: item } = await supabaseAdmin
        .from("itinerary_items")
        .select("id,status,trip_id")
        .eq("id", itemId)
        .eq("trip_id", context.tripId)
        .single();

      if (!item) return { ok: false, reason: "Item not found" };

      if (item.status === "booked_locked") {
        const { error } = await supabaseAdmin.from("cs_approval_queue").insert({
          trip_id: item.trip_id,
          item_id: item.id,
          requested_change: { type: "delete_item" },
          status: "pending",
        });

        if (error) {
          return { ok: false, error: error.message };
        }

        revalidateTag("admin:metrics", "max");
        revalidateTag(`trip:${item.trip_id}:items`, "max");
        return { ok: true, flagged: true };
      }

      const { error } = await supabaseAdmin.from("itinerary_items").delete().eq("id", itemId);
      if (error) {
        return { ok: false, error: error.message };
      }

      revalidateTag(`trip:${item.trip_id}:items`, "max");
      revalidateTag(`trip:${item.trip_id}`, "max");
      return { ok: true, flagged: false };
    },
  },

    flag_for_cs_approval: {
    description: "Queue requested major change for CS approval",
    inputSchema: z.object({
      tripId: z.string().optional(),
      itemId: z.string().optional(),
      reason: z.string(),
      requestedChange: z.record(z.string(), z.unknown()).optional(),
    }),
    execute: async (input: {
      tripId?: string;
      itemId?: string;
      reason: string;
      requestedChange?: Record<string, unknown>;
    }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const resolvedTripId = input.tripId ?? context.tripId;
      if (!isSameTripScope(context, resolvedTripId)) {
        return { ok: false, reason: "Forbidden trip scope" };
      }

      const { error } = await supabaseAdmin.from("cs_approval_queue").insert({
        trip_id: resolvedTripId,
        item_id: input.itemId ?? null,
        requested_change: {
          reason: input.reason,
          ...input.requestedChange,
        },
        status: "pending",
      });

      if (!error) {
        revalidateTag("admin:metrics", "max");
        revalidateTag(`trip:${resolvedTripId}:items`, "max");
      }

      return { ok: !error, error: error?.message };
    },
  },

    search_alternatives: {
    description: "Find alternative vendors/activities by keyword and city",
    inputSchema: z.object({
      query: z.string(),
      city: z.string().optional(),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    execute: async (input: { query: string; city?: string; limit: number }) => {
      if (!isServiceConfigured()) return { ok: false, alternatives: [] };

      let statement = supabaseAdmin
        .from("vendors")
        .select("id,name,type,city,price_tier,avg_rating")
        .ilike("name", `%${input.query}%`);

      if (input.city) {
        statement = statement.ilike("city", `%${input.city}%`);
      }

      const searchQuery = input.city ? `${input.query} ${input.city}` : input.query;
      const normalizedQuery = searchQuery.toLowerCase();
      const wantsDining = /(resto|restaurant|dinner|lunch|dining|cafe|warung|kuliner|makan)/i.test(normalizedQuery);
      const placeQuery = wantsDining
        ? `${searchQuery} restaurant official site`
        : `${searchQuery} official site`;
      const tavilyLimit = Math.min(12, Math.max(input.limit * 3, input.limit));

      const [internalResult, tavilyResult] = await Promise.allSettled([
        statement.limit(input.limit),
        searchIndonesiaPlaces(placeQuery, tavilyLimit),
      ]);

      const internalAlternatives =
        internalResult.status === "fulfilled" ? (internalResult.value.data ?? []) : [];

      const tavilyResults =
        tavilyResult.status === "fulfilled" ? tavilyResult.value : [];

      if (internalAlternatives.length > 0) {
        return { ok: true, alternatives: internalAlternatives.slice(0, input.limit) };
      }

      const guidePatterns = /(best|top|guide|list|review|reviews|where to eat|things to do|recommended|recommendations|itinerary|blogs?)/i;
      const bannedHostPatterns = /(tripadvisor|booking\.com|traveloka|expedia|agoda|yelp|michelin|klook|kkday|facebook\.com|instagram\.com|tiktok\.com|reddit\.com|quora\.com|medium\.com|blogspot\.com)/i;
      const bannedPathPatterns = /(\/blog\/|\/blogs\/|\/travel|\/article|\/articles|\/posts|\/stories|\/guide|\/category|\/tag|\/news|\/forum|\/forums|\/groups?|\/community|\/list)/i;

      const filteredTavily = tavilyResults.filter((result) => {
        const title = result.title ?? "";
        const url = result.url ?? "";
        const haystack = `${title} ${url}`.toLowerCase();
        if (guidePatterns.test(title)) return false;
        if (bannedHostPatterns.test(url)) return false;
        if (bannedPathPatterns.test(url)) return false;
        if (/[?]/.test(title)) return false;
        if (/(best|top|guide|list|review|reviews|where to eat|things to do)/i.test(haystack)) return false;
        return true;
      });

      const webAlternatives = filteredTavily.map((result, index) => ({
        id: `web-${index + 1}`,
        name: result.title,
        type: "web_result",
        city: input.city ?? "Indonesia",
        price_tier: null,
        avg_rating: null,
        url: result.url,
        snippet: result.content,
        source: "web_search",
      }));

      const combined = [...webAlternatives];
      return { ok: true, alternatives: combined.slice(0, input.limit) };
    },
  },

    swap_vendor: {
    description: "Swap vendor candidate for item, auto-flag if major/confirmed",
    inputSchema: z.object({
      tripId: z.string().optional(),
      itemId: z.string(),
      newVendorId: z.string(),
      destinationChanged: z.boolean().optional(),
      dateChanged: z.boolean().optional(),
      hotelChanged: z.boolean().optional(),
    }),
    execute: async (input: {
      tripId?: string;
      itemId: string;
      newVendorId: string;
      destinationChanged?: boolean;
      dateChanged?: boolean;
      hotelChanged?: boolean;
    }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const resolvedTripId = input.tripId ?? context.tripId;
      if (!isSameTripScope(context, resolvedTripId)) {
        return { ok: false, reason: "Forbidden trip scope" };
      }

      const { data: item } = await supabaseAdmin
        .from("itinerary_items")
        .select("id,status,trip_id")
        .eq("id", input.itemId)
        .eq("trip_id", context.tripId)
        .single();
      if (!item) return { ok: false, reason: "Item not found" };

      const major = isMajorChange(input);
      if (item.status !== "draft" || major) {
        const { error } = await supabaseAdmin.from("cs_approval_queue").insert({
          trip_id: item.trip_id,
          item_id: input.itemId,
          requested_change: {
            type: "swap_vendor",
            new_vendor_id: input.newVendorId,
            major,
          },
          status: "pending",
        });

        if (error) {
          return { ok: false, reason: error.message };
        }

        revalidateTag("admin:metrics", "max");
        revalidateTag(`trip:${item.trip_id}:items`, "max");
        return { ok: true, flagged: true };
      }

      const { error } = await supabaseAdmin
        .from("itinerary_items")
        .update({ vendor_id: input.newVendorId })
        .eq("id", input.itemId);

      if (error) {
        return { ok: false, reason: error.message };
      }

      revalidateTag(`trip:${item.trip_id}:items`, "max");
      revalidateTag(`trip:${item.trip_id}`, "max");
      return { ok: true, flagged: false };
    },
  },

    escalate_to_human_cs: {
    description: "Open CS chat session for traveler",
    inputSchema: z.object({
      tripId: z.string().optional(),
      message: z.string().optional(),
    }),
    execute: async (input: { tripId?: string; message?: string }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const resolvedTripId = input.tripId ?? context.tripId;
      if (!isSameTripScope(context, resolvedTripId)) {
        return { ok: false, reason: "Forbidden trip scope" };
      }

      const { data, error } = await supabaseAdmin
        .from("cs_chat_sessions")
        .insert({
          trip_id: context.tripId,
          user_id: context.appUserId,
          status: "open",
          messages: input.message ? [{ role: "user", content: input.message, ts: new Date().toISOString() }] : [],
        })
        .select("id")
        .single();

      if (!error) {
        revalidateTag("admin:metrics", "max");
      }

      return { ok: !error, sessionId: data?.id, error: error?.message };
    },
  },

    contact_vendor_via_whatsapp: {
    description: "Send WhatsApp message to vendor via n8n workflow",
    inputSchema: z.object({
      vendorId: z.string(),
      message: z.string(),
    }),
    execute: async (input: { vendorId: string; message: string }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      if (!context.isAdmin) {
        const { data: tripVendor } = await supabaseAdmin
          .from("itinerary_items")
          .select("id")
          .eq("trip_id", context.tripId)
          .eq("vendor_id", input.vendorId)
          .limit(1)
          .maybeSingle();

        if (!tripVendor) {
          return { ok: false, reason: "Vendor tidak terkait dengan trip ini" };
        }
      }

      const { data: vendor } = await supabaseAdmin.from("vendors").select("id,whatsapp_number").eq("id", input.vendorId).single();
      if (!vendor?.whatsapp_number) return { ok: false, reason: "Vendor WA number not found" };

      const phoneE164 = normalizePhoneToE164(vendor.whatsapp_number);
      if (!phoneE164) return { ok: false, reason: "Vendor WA number is invalid" };

      scheduleNotification({
        eventType: "vendor_contact",
        tripId: null,
        userName: "TravelYu CS",
        phoneE164,
        channelPreference: "whatsapp",
        waText: input.message,
      });

      await supabaseAdmin.from("waha_message_log").insert({
        recipient_type: "vendor",
        recipient_id: vendor.id,
        message: input.message,
        status: "queued",
      });

      return { ok: true, queued: true };
    },
  },

    get_weather_info: {
    description: "Fetch weather forecast details for city/date",
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }: { city: string }) => {
      const apiKey = process.env.OPENWEATHERMAP_API_KEY;
      if (!apiKey) {
        return { ok: false, reason: "OPENWEATHERMAP_API_KEY is missing" };
      }

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},ID&units=metric&appid=${apiKey}`,
          {
            signal: AbortSignal.timeout(5000),
          },
        );

        if (!response.ok) {
          return { ok: false, reason: "Weather API request failed" };
        }

        const payload = await response.json();
        const next = payload?.list?.[0];

        return {
          ok: true,
          city,
          summary: next?.weather?.[0]?.description ?? "unknown",
          temp: next?.main?.temp ?? null,
        };
      } catch {
        return { ok: false, reason: "Weather API request timed out" };
      }
    },
  },

    generate_packing_list: {
    description: "Generate packing recommendations based on trip context",
    inputSchema: z.object({
      destination: z.string(),
      durationDays: z.number().int().min(1),
      activities: z.array(z.string()).optional(),
    }),
    execute: async (input: { destination: string; durationDays: number; activities?: string[] }) => {
      const fallback = [
        "Sunblock",
        "Powerbank",
        "Reusable bottle",
        "Travel documents",
        "Basic medicine",
      ];

      const activityExtras = (input.activities ?? []).includes("beach")
        ? ["Sandals", "Dry bag"]
        : [];

      try {
        const { text } = await generateText({
          model,
          maxRetries: 1,
          prompt: `Generate a concise packing list for a ${input.durationDays}-day trip to ${input.destination}.
Activities: ${(input.activities ?? []).join(", ") || "general tourism"}.
Return only a JSON array of strings.`,
        });

        const parsed = extractJsonArray(text);
        if (!parsed || parsed.length === 0) {
          throw new Error("model_output_invalid");
        }

        const unique = [...new Set(parsed)].slice(0, 30);

        return {
          ok: true,
          destination: input.destination,
          items: unique.map((item) => ({ item, checked: false })),
        };
      } catch {
        const merged = [...new Set([...fallback, ...activityExtras])];

        return {
          ok: true,
          destination: input.destination,
          items: merged.map((item) => ({ item, checked: false })),
        };
      }
    },
  },
  };
}
