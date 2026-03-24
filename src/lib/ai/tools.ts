import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { isMajorChange } from "@/lib/utils";

function isServiceConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export const itineraryTools = {
  update_itinerary_item: {
    description: "Update minor editable fields for draft/booked_flexible itinerary item",
    inputSchema: z.object({
      itemId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      tips: z.string().optional(),
      timeSlot: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
    }),
    execute: async (input: {
      itemId: string;
      title?: string;
      description?: string;
      tips?: string;
      timeSlot?: "morning" | "afternoon" | "evening" | "night";
    }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const { data: item } = await supabaseAdmin
        .from("itinerary_items")
        .select("id,status")
        .eq("id", input.itemId)
        .single();

      if (!item) return { ok: false, reason: "Item not found" };
      if (item.status === "booked_locked") {
        return { ok: false, reason: "Item is locked; use flag_for_cs_approval" };
      }

      await supabaseAdmin
        .from("itinerary_items")
        .update({
          ...(input.title ? { title: input.title } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.tips ? { tips: input.tips } : {}),
          ...(input.timeSlot ? { time_slot: input.timeSlot } : {}),
        })
        .eq("id", input.itemId);

      return { ok: true };
    },
  },

  add_itinerary_item: {
    description: "Add itinerary item to specific trip day",
    inputSchema: z.object({
      tripId: z.string(),
      dayNumber: z.number().int().min(1),
      timeSlot: z.enum(["morning", "afternoon", "evening", "night"]),
      activityType: z.enum(["accommodation", "transport", "dining", "attraction", "experience", "rest"]),
      title: z.string(),
      description: z.string(),
      estCostIdr: z.number().int().min(0),
    }),
    execute: async (input: {
      tripId: string;
      dayNumber: number;
      timeSlot: "morning" | "afternoon" | "evening" | "night";
      activityType: "accommodation" | "transport" | "dining" | "attraction" | "experience" | "rest";
      title: string;
      description: string;
      estCostIdr: number;
    }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const { error } = await supabaseAdmin.from("itinerary_items").insert({
        trip_id: input.tripId,
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

      const { data: item } = await supabaseAdmin.from("itinerary_items").select("id,status,trip_id").eq("id", itemId).single();

      if (!item) return { ok: false, reason: "Item not found" };

      if (item.status === "booked_locked") {
        await supabaseAdmin.from("cs_approval_queue").insert({
          trip_id: item.trip_id,
          item_id: item.id,
          requested_change: { type: "delete_item" },
          status: "pending",
        });
        return { ok: true, flagged: true };
      }

      await supabaseAdmin.from("itinerary_items").delete().eq("id", itemId);
      return { ok: true, flagged: false };
    },
  },

  flag_for_cs_approval: {
    description: "Queue requested major change for CS approval",
    inputSchema: z.object({
      tripId: z.string(),
      itemId: z.string().optional(),
      reason: z.string(),
      requestedChange: z.record(z.string(), z.unknown()).optional(),
    }),
    execute: async (input: {
      tripId: string;
      itemId?: string;
      reason: string;
      requestedChange?: Record<string, unknown>;
    }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const { error } = await supabaseAdmin.from("cs_approval_queue").insert({
        trip_id: input.tripId,
        item_id: input.itemId ?? null,
        requested_change: {
          reason: input.reason,
          ...input.requestedChange,
        },
        status: "pending",
      });
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

      let statement = supabaseAdmin.from("vendors").select("id,name,type,city,price_tier,avg_rating").ilike("name", `%${input.query}%`);

      if (input.city) {
        statement = statement.ilike("city", `%${input.city}%`);
      }

      const { data } = await statement.limit(input.limit);
      return { ok: true, alternatives: data ?? [] };
    },
  },

  swap_vendor: {
    description: "Swap vendor candidate for item, auto-flag if major/confirmed",
    inputSchema: z.object({
      tripId: z.string(),
      itemId: z.string(),
      newVendorId: z.string(),
      destinationChanged: z.boolean().optional(),
      dateChanged: z.boolean().optional(),
      hotelChanged: z.boolean().optional(),
    }),
    execute: async (input: {
      tripId: string;
      itemId: string;
      newVendorId: string;
      destinationChanged?: boolean;
      dateChanged?: boolean;
      hotelChanged?: boolean;
    }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const { data: item } = await supabaseAdmin.from("itinerary_items").select("id,status").eq("id", input.itemId).single();
      if (!item) return { ok: false, reason: "Item not found" };

      const major = isMajorChange(input);
      if (item.status !== "draft" || major) {
        await supabaseAdmin.from("cs_approval_queue").insert({
          trip_id: input.tripId,
          item_id: input.itemId,
          requested_change: {
            type: "swap_vendor",
            new_vendor_id: input.newVendorId,
            major,
          },
          status: "pending",
        });
        return { ok: true, flagged: true };
      }

      await supabaseAdmin.from("itinerary_items").update({ vendor_id: input.newVendorId }).eq("id", input.itemId);
      return { ok: true, flagged: false };
    },
  },

  escalate_to_human_cs: {
    description: "Open CS chat session for traveler",
    inputSchema: z.object({
      tripId: z.string(),
      userId: z.string(),
      message: z.string().optional(),
    }),
    execute: async (input: { tripId: string; userId: string; message?: string }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const { data, error } = await supabaseAdmin
        .from("cs_chat_sessions")
        .insert({
          trip_id: input.tripId,
          user_id: input.userId,
          status: "open",
          messages: input.message ? [{ role: "user", content: input.message, ts: new Date().toISOString() }] : [],
        })
        .select("id")
        .single();

      return { ok: !error, sessionId: data?.id, error: error?.message };
    },
  },

  contact_vendor_via_whatsapp: {
    description: "Send WhatsApp message to vendor via WA endpoint",
    inputSchema: z.object({
      vendorId: z.string(),
      message: z.string(),
    }),
    execute: async (input: { vendorId: string; message: string }) => {
      if (!isServiceConfigured()) return { ok: false, reason: "Supabase service role is not configured" };

      const { data: vendor } = await supabaseAdmin.from("vendors").select("id,whatsapp_number").eq("id", input.vendorId).single();
      if (!vendor?.whatsapp_number) return { ok: false, reason: "Vendor WA number not found" };

      const response = await fetch(`${process.env.WAHA_API_URL}/api/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WAHA_API_KEY ?? ""}`,
        },
        body: JSON.stringify({
          chatId: vendor.whatsapp_number,
          text: input.message,
        }),
      });

      await supabaseAdmin.from("waha_message_log").insert({
        recipient_type: "vendor",
        recipient_id: vendor.id,
        message: input.message,
        status: response.ok ? "sent" : "failed",
      });

      return { ok: response.ok };
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

      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},ID&units=metric&appid=${apiKey}`,
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
      const base = ["Sunblock", "Powerbank", "Reusable bottle", "Travel documents", "Basic medicine"];
      const activityExtras = (input.activities ?? []).includes("beach") ? ["Sandals", "Dry bag"] : [];

      return {
        ok: true,
        destination: input.destination,
        items: [...base, ...activityExtras].map((item) => ({ item, checked: false })),
      };
    },
  },
};
