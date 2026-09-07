import { generateText } from "ai";

import { getCurrentAppUser } from "@/lib/auth";
import { model, hasConfiguredOpenRouter } from "@/lib/ai/openrouter";
import { PARSE_BOOKING_SYSTEM_PROMPT, fallbackParseBooking } from "@/lib/booking-parser";
import { requireAiCredits } from "@/lib/credits";
import { checkAiRateLimit } from "@/lib/rate-limit";
import type { ParsedBooking } from "@/types/domain";

/**
 * POST /api/ai/parse-booking — "Reverse planning" ticket parser.
 * Body: { text: string, tripId?: string }
 * Costs 3 AI credits. Falls back to deterministic regex parser when LLM is unavailable.
 */
export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimited = await checkAiRateLimit(appUser.id, "parse-booking");
  if (rateLimited) return rateLimited;

  let body: { text?: string; tripId?: string };
  try {
    body = (await request.json()) as { text?: string; tripId?: string };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = String(body.text ?? "").trim();
  if (raw.length < 10) {
    return Response.json({ error: "Tempel teks tiket/booking minimal 10 karakter." }, { status: 400 });
  }
  if (raw.length > 8000) {
    return Response.json({ error: "Teks terlalu panjang (maks 8000 karakter)." }, { status: 400 });
  }

  const creditBlock = await requireAiCredits(appUser.id, "parse-booking", { tripId: body.tripId });
  if (creditBlock) return creditBlock;

  const fallback = fallbackParseBooking(raw);

  if (!hasConfiguredOpenRouter) {
    return Response.json({ parsed: fallback, source: "fallback", creditsCharged: 0 });
  }

  try {
    const { text } = await generateText({
      model,
      maxRetries: 1,
      system: PARSE_BOOKING_SYSTEM_PROMPT,
      prompt: `Parse tiket berikut:\n\n${raw.slice(0, 4000)}`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ parsed: fallback, source: "fallback-ai-empty" });

    const parsed = JSON.parse(jsonMatch[0]) as ParsedBooking;
    return Response.json({
      parsed: {
        booking_type: parsed.booking_type ?? fallback.booking_type,
        provider: parsed.provider ?? fallback.provider,
        booking_ref: parsed.booking_ref ?? fallback.booking_ref,
        title: parsed.title ?? fallback.title,
        origin: parsed.origin ?? fallback.origin,
        destination: parsed.destination ?? fallback.destination,
        depart_at: parsed.depart_at ?? null,
        arrive_at: parsed.arrive_at ?? null,
        check_in: parsed.check_in ?? null,
        check_out: parsed.check_out ?? null,
        details: { ...(parsed.details ?? {}), rawExcerpt: raw.slice(0, 300) },
        confidence: parsed.confidence ?? "medium",
      } satisfies ParsedBooking,
      source: "ai",
    });
  } catch {
    return Response.json({ parsed: fallback, source: "fallback-ai-error" });
  }
}
