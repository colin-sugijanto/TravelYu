import { getCurrentAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id,user_id,intake_data")
    .eq("id", id)
    .maybeSingle();

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const response = await fetch(new URL("/api/ai/generate-trip", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tripId: trip.id,
      intakeData: trip.intake_data,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    return Response.json(payload, { status: response.status });
  }

  return Response.json({ ok: true });
}
