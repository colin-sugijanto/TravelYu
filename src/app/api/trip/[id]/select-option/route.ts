import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { optionNumber?: number };

  if (!body.optionNumber || body.optionNumber < 1 || body.optionNumber > 3) {
    return Response.json({ error: "Invalid optionNumber" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabase.from("trips").select("id,user_id").eq("id", id).maybeSingle();
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await Promise.all([
    supabase.from("comparison_options").update({ is_selected: false }).eq("trip_id", id),
    supabase.from("comparison_options").update({ is_selected: true }).eq("trip_id", id).eq("option_number", body.optionNumber),
    supabase
      .from("trip_preferences")
      .upsert(
        {
          trip_id: id,
          selected_option_number: body.optionNumber,
          selected_at: new Date().toISOString(),
        },
        { onConflict: "trip_id" },
      ),
    supabase.from("trips").update({ selected_comparison_option: body.optionNumber, updated_at: new Date().toISOString() }).eq("id", id),
  ]);

  return Response.json({ ok: true });
}
