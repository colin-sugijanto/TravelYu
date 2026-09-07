import { revalidateTag } from "next/cache";
import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { findTripByIdentifier } from "@/lib/trip-access";
import { POST as generateTripHandler } from "@/app/api/ai/generate-trip/route";

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { selectedOption?: number };
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{
    id: string;
    user_id: string;
    intake_data: Record<string, unknown> | null;
    selected_comparison_option: number | null;
  }>(id, "id,user_id,intake_data,selected_comparison_option");

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id && !isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const selectedOption = body.selectedOption ?? trip.selected_comparison_option;

  if (!selectedOption || selectedOption < 1 || selectedOption > 3) {
    return Response.json({ error: "Pilih salah satu opsi comparison dulu sebelum generate itinerary." }, { status: 400 });
  }

  const internalRequest = new Request(new URL("/api/ai/generate-trip", request.url), {
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

  const response = await generateTripHandler(internalRequest);

  revalidateTag(`trip:${trip.id}`, "max");
  revalidateTag(`trip:${trip.id}:items`, "max");
  revalidateTag("admin:metrics", "max");

  return response;
}
