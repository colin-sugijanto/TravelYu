import { revalidateTag } from "next/cache";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier } from "@/lib/trip-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { optionNumber?: number };

  if (!body.optionNumber || body.optionNumber < 1 || body.optionNumber > 3) {
    return Response.json({ error: "Invalid optionNumber" }, { status: 400 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id && !isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: clearError } = await supabaseAdmin
    .from("comparison_options")
    .update({ is_selected: false })
    .eq("trip_id", trip.id);
  if (clearError) {
    return Response.json({ error: clearError.message }, { status: 500 });
  }

  const { data: selectedRow, error: selectError } = await supabaseAdmin
    .from("comparison_options")
    .update({ is_selected: true })
    .eq("trip_id", trip.id)
    .eq("option_number", body.optionNumber)
    .select("id")
    .maybeSingle();
  if (selectError) {
    return Response.json({ error: selectError.message }, { status: 500 });
  }
  if (!selectedRow) {
    return Response.json({ error: "Selected comparison option not found" }, { status: 404 });
  }

  const [tripPreferenceResult, tripUpdateResult] = await Promise.all([
    supabaseAdmin.from("trip_preferences").upsert(
      {
        trip_id: trip.id,
        selected_option_number: body.optionNumber,
        selected_at: new Date().toISOString(),
      },
      { onConflict: "trip_id" },
    ),
    supabaseAdmin
      .from("trips")
      .update({
        selected_comparison_option: body.optionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", trip.id),
  ]);

  if (tripPreferenceResult.error) {
    return Response.json({ error: tripPreferenceResult.error.message }, { status: 500 });
  }

  if (tripUpdateResult.error) {
    return Response.json({ error: tripUpdateResult.error.message }, { status: 500 });
  }

  revalidateTag(`trip:${trip.id}`, "max");
  revalidateTag(`trip:${trip.id}:comparison-options`, "max");
  if (trip.id !== id) {
    revalidateTag(`trip:${id}`, "max");
    revalidateTag(`trip:${id}:comparison-options`, "max");
  }
  revalidateTag("admin:metrics", "max");

  return Response.json({ ok: true });
}
