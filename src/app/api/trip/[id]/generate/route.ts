import { revalidateTag } from "next/cache";

import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  // Run the actual AI generation in the background without awaiting it
  (async () => {
    try {
      const response = await fetch(new URL("/api/ai/generate-trip", request.url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass cookie if needed for internal API authentication, though for background tasks
          // it might be more robust to use an admin key or rely on tripId for authorization within the AI endpoint.
          ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : {}),
        },
        body: JSON.stringify({
          tripId: trip.id,
          intakeData: trip.intake_data,
          selectedOption,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        console.error(`Background AI generation failed for trip ${trip.id}:`, payload);
        // If AI generation fails, update trip status to 'intake'
        await supabaseAdmin.from("trips").update({ status: "intake" }).eq("id", trip.id);
      } else {
        console.log(`Background AI generation successful for trip ${trip.id}`);
        // The /api/ai/generate-trip endpoint is expected to update the trip with the generated itinerary
        // and set its status to 'completed' or similar upon success.
      }
    } catch (error) {
      console.error(`Error during background AI generation for trip ${trip.id}:`, error);
      // Update trip status to 'intake' on unexpected errors during the background process
      await supabaseAdmin.from("trips").update({ status: "intake" }).eq("id", trip.id);
    } finally {
      // Revalidate tags again to reflect the final state (success/failure) and any new data
      revalidateTag(`trip:${trip.id}`, "max");
      revalidateTag(`trip:${trip.id}:items`, "max");
      revalidateTag("admin:metrics", "max");
    }
  })(); // Immediately invoke the async function

  // Immediately return 202 Accepted to the client
  return Response.json({ ok: true, status: "generating" }, { status: 202 });
}
