import { generateText, tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { getCurrentAppUser } from "@/lib/auth";
import { model, hasConfiguredOpenRouter } from "@/lib/ai/openrouter";
import { parseAiProviderError } from "@/lib/ai/errors";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateRequest, compareOptionsSchema } from "@/lib/validators";

const compareTool = tool({
  description: "Persist generated trip comparison options",
  inputSchema: z.object({
    tripId: z.string(),
    options: z
      .array(
        z.object({
          optionNumber: z.number().int().min(1).max(3),
          title: z.string(),
          destinationHighlights: z.array(z.string()),
          vibeTags: z.array(z.string()),
          estimatedBudgetIdr: z.number().int().min(0),
          rationale: z.string(),
        }),
      )
      .min(2)
      .max(3),
  }),
  execute: async (input) => saveComparisonOptions(input.tripId, input.options),
});

type CompareOptionInput = {
  optionNumber: number;
  title: string;
  destinationHighlights: string[];
  vibeTags: string[];
  estimatedBudgetIdr: number;
  rationale: string;
};

async function saveComparisonOptions(tripId: string, options: CompareOptionInput[]) {
  await supabaseAdmin.from("comparison_options").delete().eq("trip_id", tripId);

  const rows = options.map((option) => ({
    trip_id: tripId,
    option_number: option.optionNumber,
    summary: {
      title: option.title,
      destinationHighlights: option.destinationHighlights,
      vibeTags: option.vibeTags,
      estimatedBudgetIdr: option.estimatedBudgetIdr,
      rationale: option.rationale,
    },
    is_selected: option.optionNumber === 1,
  }));

  const { error } = await supabaseAdmin.from("comparison_options").insert(rows);
  if (!error) {
    revalidateTag(`trip:${tripId}:comparison-options`, "max");
    revalidateTag(`trip:${tripId}`, "max");
    revalidateTag("admin:metrics", "max");
  }

  return { ok: !error, error: error?.message };
}

function inferDestinationFromSummary(summary: string) {
  const knownDestinations = [
    "Bali",
    "Lombok",
    "Yogyakarta",
    "Jakarta",
    "Bandung",
    "Labuan Bajo",
    "Raja Ampat",
    "Bromo",
    "Nusa Penida",
    "Surabaya",
  ];

  const normalized = summary.toLowerCase();
  return knownDestinations.find((dest) => normalized.includes(dest.toLowerCase())) ?? "Bali";
}

function inferBudgetBase(summary: string) {
  const normalized = summary.toLowerCase();
  const match = normalized.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(juta|jt|m|ribu|rb|k)?/i);
  if (!match) return 6_000_000;

  const raw = Number(match[1].replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, "."));
  if (!Number.isFinite(raw) || raw <= 0) return 6_000_000;

  const suffix = (match[2] ?? "").toLowerCase();
  if (suffix === "juta" || suffix === "jt" || suffix === "m") return Math.round(raw * 1_000_000);
  if (suffix === "ribu" || suffix === "rb" || suffix === "k") return Math.round(raw * 1_000);
  return Math.round(raw);
}

function buildFallbackComparisonOptions(intakeSummary: string): CompareOptionInput[] {
  const destination = inferDestinationFromSummary(intakeSummary);
  const baseBudget = inferBudgetBase(intakeSummary);

  return [
    {
      optionNumber: 1,
      title: `Smart Saver ${destination}`,
      destinationHighlights: [
        `${destination} pusat kota`,
        "Kuliner lokal ramah budget",
        "Aktivitas gratis/low-cost",
      ],
      vibeTags: ["budget", "simple", "local"],
      estimatedBudgetIdr: Math.max(2_500_000, Math.round(baseBudget * 0.8)),
      rationale:
        "Fokus efisiensi biaya tanpa kehilangan pengalaman inti destinasi, cocok untuk traveler yang ingin value terbaik.",
    },
    {
      optionNumber: 2,
      title: `Balanced Explorer ${destination}`,
      destinationHighlights: [
        "Campuran spot populer & hidden gem",
        "Ritme aktivitas seimbang",
        "Pilihan makan variatif",
      ],
      vibeTags: ["balanced", "comfort", "explore"],
      estimatedBudgetIdr: Math.max(3_500_000, Math.round(baseBudget)),
      rationale:
        "Kombinasi nyaman antara eksplorasi, kuliner, dan waktu istirahat dengan alokasi budget yang seimbang.",
    },
    {
      optionNumber: 3,
      title: `Premium Escape ${destination}`,
      destinationHighlights: [
        "Pengalaman eksklusif",
        "Tempat makan premium",
        "Transportasi lebih nyaman",
      ],
      vibeTags: ["premium", "comfort+", "exclusive"],
      estimatedBudgetIdr: Math.max(5_000_000, Math.round(baseBudget * 1.35)),
      rationale:
        "Dirancang untuk kenyamanan maksimal dengan pengalaman yang lebih personal dan premium sepanjang perjalanan.",
    },
  ];
}

export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await checkAiRateLimit(appUser.id, "compare-options");
  if (blocked) {
    return blocked;
  }

  if (!hasConfiguredOpenRouter || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "AI compare options service is not configured" }, { status: 503 });
  }

  let body: { tripId: string; intakeSummary: string };
  try {
    const rawData = await request.json();
    body = validateRequest(compareOptionsSchema, rawData);
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

  const sanitizedSummary = body.intakeSummary.slice(0, 5000);

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id,user_id,intake_data")
    .eq("id", body.tripId)
    .maybeSingle();
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id && appUser.role !== "admin" && appUser.role !== "super_admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabaseAdmin
    .from("trips")
    .update({
      intake_data: {
        ...((trip.intake_data as Record<string, unknown> | null) ?? {}),
        summary: sanitizedSummary,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.tripId);

  try {
    const result = await generateText({
      model,
      maxRetries: 2,
      prompt: `
Generate 3 distinct itinerary comparison options.

Trip ID: ${body.tripId}
Intake Summary: ${sanitizedSummary}

Call save_comparison_options with structured options.

Constraints:
- Opsi 1 harus budget-focused.
- Opsi 2 harus balanced.
- Opsi 3 harus premium-experience.
- Semua destinasi wajib di Indonesia.
`,
      tools: {
        save_comparison_options: compareTool,
      },
    });

    return Response.json({
      ok: true,
      text: result.text,
    });
  } catch (error) {
    const parsed = parseAiProviderError(error, {
      defaultMessage: "AI compare options gagal sementara. Coba lagi dalam beberapa saat.",
      rateLimitedMessage: "Layanan AI sedang padat (rate-limited). Coba lagi 20-60 detik lagi.",
    });

    const fallbackOptions = buildFallbackComparisonOptions(sanitizedSummary);
    const fallbackSave = await saveComparisonOptions(body.tripId, fallbackOptions);
    if (fallbackSave.ok) {
      return Response.json({
        ok: true,
        fallback: true,
        message: "Menggunakan opsi fallback agar kamu tetap bisa lanjut memilih itinerary.",
      });
    }

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
          : undefined,
      },
    );
  }
}
