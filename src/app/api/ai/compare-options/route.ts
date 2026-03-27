import { generateText, tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { getCurrentAppUser } from "@/lib/auth";
import { model } from "@/lib/ai/openrouter";
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
  execute: async (input) => {
    await supabaseAdmin.from("comparison_options").delete().eq("trip_id", input.tripId);

    const rows = input.options.map((option) => ({
      trip_id: input.tripId,
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
      revalidateTag(`trip:${input.tripId}:comparison-options`, "max");
      revalidateTag(`trip:${input.tripId}`, "max");
      revalidateTag("admin:metrics", "max");
    }

    return { ok: !error, error: error?.message };
  },
});

export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await checkAiRateLimit(appUser.id, "compare-options");
  if (blocked) {
    return blocked;
  }

  if (!process.env.OPENROUTER_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
