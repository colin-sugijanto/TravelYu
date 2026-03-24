import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id,user_id,payment_status,intake_data")
    .eq("id", id)
    .maybeSingle();

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (trip.payment_status !== "paid") {
    return Response.json({ error: "Payment pending" }, { status: 400 });
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
