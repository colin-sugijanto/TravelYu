import { generateText, tool } from "ai";
import { z } from "zod";

import { model } from "@/lib/ai/openrouter";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
    return { ok: !error, error: error?.message };
  },
});

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "AI compare options service is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    tripId: string;
    intakeSummary: string;
  };

  const result = await generateText({
    model,
    prompt: `
Generate 3 distinct pre-payment itinerary comparison options.

Trip ID: ${body.tripId}
Intake Summary: ${body.intakeSummary}

Call save_comparison_options with structured options.
`,
    tools: {
      save_comparison_options: compareTool,
    },
  });

  return Response.json({
    ok: true,
    text: result.text,
  });
}
