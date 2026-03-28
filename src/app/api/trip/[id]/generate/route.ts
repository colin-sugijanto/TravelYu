import { after } from "next/server";

import { revalidateTag } from "next/cache";
import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { POST as generateTripHandler } from "@/app/api/ai/generate-trip/route";

function shouldKeepGeneratingOnError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  if (message.includes("headers timeout")) return true;
  if (message.includes("und_err_headers_timeout")) return true;
  if (message.includes("fetch failed")) return true;

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String((cause as { code?: unknown }).code ?? "").toLowerCase();
    if (code === "und_err_headers_timeout" || code === "headers_timeout") {
      return true;
    }
  }

  return false;
}

async function markTripStatus(
  tripId: string,
  status: "intake" | "generating" | "approved" | "draft",
) {
  await supabaseAdmin
    .from("trips")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", tripId);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { selectedOption?: number };
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id,user_id,intake_data,selected_comparison_option")
    .eq("id", id)
    .maybeSingle();

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const selectedOption = body.selectedOption ?? trip.selected_comparison_option;

  if (!selectedOption || selectedOption < 1 || selectedOption > 3) {
    return Response.json({ error: "Pilih salah satu opsi comparison dulu sebelum generate itinerary." }, { status: 400 });
  }

  // Update trip status to 'generating' immediately
  const { error: updateError } = await supabaseAdmin
    .from("trips")
    .update({ status: "generating" })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to update trip status to generating:", updateError);
    return Response.json({ error: "Failed to update trip status" }, { status: 500 });
  }

  // Revalidate the trip tag so the client can see the status change
  revalidateTag(`trip:${trip.id}`, "max");

  after(async () => {
    try {
      const internalRequest = new Request(
        new URL("/api/ai/generate-trip", request.url),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : {}),
          },
          body: JSON.stringify({
            tripId: trip.id,
            intakeData: trip.intake_data,
            selectedOption,
          }),
        },
      );

      const response = await generateTripHandler(internalRequest);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        console.error(`Background AI generation returned non-OK for trip ${trip.id}:`, payload);

        const errorText = (payload?.error ?? "").toLowerCase();
        if (response.status === 429 || errorText.includes("rate-limit") || errorText.includes("rate limited")) {
          await markTripStatus(trip.id, "approved");
        } else {
          await markTripStatus(trip.id, "intake");
        }
      }
    } catch (error) {
      console.error(`Error during background AI generation for trip ${trip.id}:`, error);

      if (!shouldKeepGeneratingOnError(error)) {
        await markTripStatus(trip.id, "approved");
      }
    } finally {
      revalidateTag(`trip:${trip.id}`, "max");
      revalidateTag(`trip:${trip.id}:items`, "max");
      revalidateTag("admin:metrics", "max");
    }
  });

  return Response.json({ ok: true, status: "generating" }, { status: 202 });
}
