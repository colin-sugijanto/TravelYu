import { streamText, tool } from "ai";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { toModelMessages } from "@/lib/ai/messages";
import { createItineraryTools } from "@/lib/ai/tools";
import { model } from "@/lib/ai/provider";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { getItineraryItems } from "@/lib/data";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

const EDITOR_SYSTEM_PROMPT = `
Kamu adalah editor itinerary TravelYu.

Aturan kritis:
1. Jangan update item status booked_locked secara langsung. Gunakan flag_for_cs_approval.
2. Vendor swap pada booking confirmed harus lewat CS approval.
3. Konfirmasi intent user lalu lakukan tool call.
4. Jika ragu major/minor change, default ke flag_for_cs_approval.

Jawab dalam Bahasa Indonesia, ringkas, actionable.
`;

export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await checkAiRateLimit(appUser.id, "editor");
  if (blocked) {
    return blocked;
  }

  const { messages, tripId } = (await request.json()) as {
    messages: unknown;
    tripId: string;
  };

  if (!tripId || typeof tripId !== "string") {
    return Response.json({ error: "tripId is required" }, { status: 400 });
  }

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(
    tripId,
    "id,user_id",
  );

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  const isAdmin = isAdminRole(appUser.role);
  if (!isAdmin && trip.user_id !== appUser.id) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const itineraryItems = await getItineraryItems(trip.id);
  const itineraryContext = itineraryItems
    .slice(0, 60)
    .map((item) => {
      const parts = [
        `day=${item.day_number}`,
        `slot=${item.time_slot}`,
        `type=${item.activity_type}`,
        `title=${item.title}`,
      ];
      if (item.location_address) {
        parts.push(`location=${item.location_address}`);
      }
      if (typeof item.est_cost_idr === "number") {
        parts.push(`cost=${item.est_cost_idr}`);
      }
      return parts.join(" | ");
    })
    .join("\n");

  const modelMessages = await toModelMessages(messages);
  const itineraryTools = createItineraryTools({
    tripId: trip.id,
    appUserId: appUser.id,
    isAdmin,
  });

  const result = streamText({
    model,
    maxRetries: 2,
    system: `${EDITOR_SYSTEM_PROMPT}\nTrip ID aktif: ${trip.id}\nUser ID aktif: ${appUser.id}\n\nCurrent itinerary items:\n${itineraryContext || "(no itinerary items found)"}`,
    messages: modelMessages,
    tools: {
      update_itinerary_item: tool(itineraryTools.update_itinerary_item),
      add_itinerary_item: tool(itineraryTools.add_itinerary_item),
      delete_itinerary_item: tool(itineraryTools.delete_itinerary_item),
      swap_vendor: tool(itineraryTools.swap_vendor),
      search_alternatives: tool(itineraryTools.search_alternatives),
      flag_for_cs_approval: tool(itineraryTools.flag_for_cs_approval),
      contact_vendor_via_whatsapp: tool(itineraryTools.contact_vendor_via_whatsapp),
      get_weather_info: tool(itineraryTools.get_weather_info),
      escalate_to_human_cs: tool(itineraryTools.escalate_to_human_cs),
      generate_packing_list: tool(itineraryTools.generate_packing_list),
    },
  });

  return result.toUIMessageStreamResponse();
}
