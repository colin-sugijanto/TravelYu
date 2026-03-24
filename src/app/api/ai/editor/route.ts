import { generateText, tool } from "ai";

import { itineraryTools } from "@/lib/ai/tools";
import { model } from "@/lib/ai/openrouter";
import { getRateLimiter } from "@/lib/rate-limit";

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
  const limiter = getRateLimiter();
  if (limiter) {
    const key = request.headers.get("x-forwarded-for") ?? "anonymous";
    const result = await limiter.limit(`ai_editor:${key}`);
    if (!result.success) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  const { messages } = (await request.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const conversation = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const result = await generateText({
    model,
    system: EDITOR_SYSTEM_PROMPT,
    prompt: `Percakapan editor:\n${conversation}\n\nJawab dengan aksi yang diperlukan. Gunakan tools jika perlu.`,
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

  return Response.json({ text: result.text });
}
