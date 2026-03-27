import { revalidateTag } from "next/cache";
import { after } from "next/server";

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

  after(async () => {
    try {
      const response = await fetch(new URL("/api/ai/generate-trip", request.url), {
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
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        console.error(`Background AI generation failed for trip ${trip.id}:`, payload);
        await supabaseAdmin
          .from("trips")
          .update({ status: "intake", updated_at: new Date().toISOString() })
          .eq("id", trip.id);
      }
    } catch (error) {
      console.error(`Error during background AI generation for trip ${trip.id}:`, error);
      await supabaseAdmin
        .from("trips")
        .update({ status: "intake", updated_at: new Date().toISOString() })
        .eq("id", trip.id);
    } finally {
      revalidateTag(`trip:${trip.id}`, "max");
      revalidateTag(`trip:${trip.id}:items`, "max");
      revalidateTag("admin:metrics", "max");
    }
  });

  return Response.json({ ok: true, status: "generating" }, { status: 202 });
}
