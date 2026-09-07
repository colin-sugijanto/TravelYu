import { streamText, tool } from "ai";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { toModelMessages } from "@/lib/ai/messages";
import { createItineraryTools } from "@/lib/ai/tools";
import { model } from "@/lib/ai/openrouter";
import { requireAiCredits } from "@/lib/credits";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { getItineraryItems } from "@/lib/data";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

const EDITOR_SYSTEM_PROMPT = `
Kamu adalah TravelYu AI Trip Editor, asisten copilot cerdas untuk modifikasi, penyempurnaan, dan koordinasi itinerary perjalanan Indonesia secara real-time.

## Tool Dispatch Matrix & Kebijakan Eksekusi:
1. **Pencarian Alternatif (search_alternatives)**:
   - Gunakan saat user ingin mencari pengganti aktivitas/resto/hotel.
   - Kembalikan ringkasan opsi menarik yang ditemukan kepada user.
2. **Memilih / Menerapkan Alternatif**:
   - Jika user memilih opsi ber-ID UUID database: panggil 'swap_vendor'.
   - Jika user memilih hasil web (ID 'web-...' atau nama tempat baru): panggil 'update_itinerary_item' untuk memperbarui title, description, locationAddress, estCostIdr, dan bookingUrl.
   - Jangan memanggil 'search_alternatives' ulang jika user sudah menunjuk opsi yang ada.
3. **Item Status & Aturan CS (Customer Service)**:
   - Item berstatus 'booked_locked': DILARANG diubah/dihapus langsung. Wajib panggil 'flag_for_cs_approval' dengan alasan detail.
   - Vendor swap pada booking yang sudah confirmed/locked: Wajib panggil 'flag_for_cs_approval'.
   - Masalah rumit, keluhan berat, refund, atau permintaan darurat: panggil 'escalate_to_human_cs'.
4. **Informasi Cuaca & Packing**:
   - Jika user bertanya cuaca destinasi: panggil 'get_weather_info'.
   - Jika user minta checklist barang bawaan: panggil 'generate_packing_list'.
5. **Kontak Vendor**:
   - Untuk konfirmasi reservasi/inquiry vendor via WhatsApp: panggil 'contact_vendor_via_whatsapp'.
6. **Tambah / Hapus Item**:
   - Menambahkan slot baru: panggil 'add_itinerary_item'.
   - Menghapus aktivitas draft/flexible: panggil 'delete_itinerary_item'.

## Gaya Respon:
- Gunakan Bahasa Indonesia yang ramah, ringkas, dan actionable.
- Selalu laporkan perubahan yang berhasil dilakukan secara transparan.
`;

type UiMessagePart = {
  type?: string;
  toolInvocation?: {
    toolName?: string;
    state?: string;
    result?: Record<string, unknown>;
  };
  toolName?: string;
  state?: string;
  result?: Record<string, unknown>;
  output?: Record<string, unknown>;
};

function getToolInvocation(part: UiMessagePart) {
  if (part.toolInvocation) return part.toolInvocation;

  const type = typeof part.type === "string" ? part.type : "";
  if (type.startsWith("tool-")) {
    const inferredToolName = part.toolName ?? type.replace(/^tool-/, "");
    const normalizedState = part.state ?? (part.output ? "result" : "call");
    return {
      toolName: inferredToolName,
      state: normalizedState,
      result: part.result ?? part.output,
    };
  }

  if (typeof part.toolName === "string") {
    return {
      toolName: part.toolName,
      state: part.state,
      result: part.result,
    };
  }

  return null;
}

function extractLatestAlternatives(messages: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i] as { parts?: UiMessagePart[] } | null;
    const parts = message?.parts;
    if (!Array.isArray(parts)) continue;

    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const invocation = getToolInvocation(parts[j] ?? {});
      if (!invocation || invocation.toolName !== "search_alternatives") continue;

      const result = invocation.result as { alternatives?: unknown } | undefined;
      const alternatives = Array.isArray(result?.alternatives)
        ? (result?.alternatives as Array<Record<string, unknown>>)
        : null;
      if (alternatives && alternatives.length > 0) return alternatives;
    }
  }

  return null;
}

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

  const creditBlock = await requireAiCredits(appUser.id, "editor", { tripId: trip.id });
  if (creditBlock) return creditBlock;

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
  const recentAlternativesRaw = extractLatestAlternatives(messages);
  const recentAlternativesJson = recentAlternativesRaw
    ? JSON.stringify(recentAlternativesRaw.slice(0, 5))
    : "";
  const itineraryTools = createItineraryTools({
    tripId: trip.id,
    appUserId: appUser.id,
    isAdmin,
  });

  const result = streamText({
    model,
    maxRetries: 2,
    system: `${EDITOR_SYSTEM_PROMPT}\nTrip ID aktif: ${trip.id}\nUser ID aktif: ${appUser.id}\n\nCurrent itinerary items:\n${itineraryContext || "(no itinerary items found)"}${recentAlternativesJson ? `\n\nAlternatif terakhir (JSON):\n${recentAlternativesJson}` : ""}`,
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
