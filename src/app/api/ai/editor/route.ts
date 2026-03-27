import { streamText, tool } from "ai";

import { getCurrentAppUser } from "@/lib/auth";
import { toModelMessages } from "@/lib/ai/messages";
import { itineraryTools } from "@/lib/ai/tools";
import { model } from "@/lib/ai/openrouter";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { getItineraryItems } from "@/lib/data";

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

  const { messages, tripId, userId } = (await request.json()) as {
    messages: unknown;
    tripId: string;
    userId?: string;
  };

  const itineraryItems = await getItineraryItems(tripId);
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

  const result = streamText({
    model,
    maxRetries: 2,
    system: `${EDITOR_SYSTEM_PROMPT}\nTrip ID aktif: ${tripId}\nUser ID aktif: ${userId ?? "unknown"}\n\nCurrent itinerary items:\n${itineraryContext || "(no itinerary items found)"}`,
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
