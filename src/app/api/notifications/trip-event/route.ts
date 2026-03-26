import { resolveTripRecipient, sendTravelYuNotification } from "@/lib/notifications";

const allowedEvents = new Set([
  "itinerary_ready",
  "cs_approved",
  "trip_reminder_h1",
]);

export async function POST(request: Request) {
  const expected = process.env.TRAVELYU_INTERNAL_API_TOKEN;
  if (expected) {
    const token = request.headers.get("x-travelyu-token");
    if (!token || token !== expected) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = (await request.json()) as {
    eventType?: string;
    tripId?: string;
    channelPreference?: "email" | "whatsapp" | "both";
  };

  if (!body.eventType || !allowedEvents.has(body.eventType)) {
    return Response.json({ error: "Invalid eventType" }, { status: 400 });
  }

  if (!body.tripId) {
    return Response.json({ error: "tripId is required" }, { status: 400 });
  }

  const recipient = await resolveTripRecipient(body.tripId);
  if (!recipient) {
    return Response.json({ error: "Trip or recipient not found" }, { status: 404 });
  }

  const result = await sendTravelYuNotification({
    eventType: body.eventType as "itinerary_ready" | "cs_approved" | "trip_reminder_h1",
    tripId: recipient.tripId,
    userName: recipient.userName,
    email: recipient.email,
    phoneE164: recipient.phoneE164,
    channelPreference: body.channelPreference ?? "both",
  });

  return Response.json({ ok: result.ok, skipped: result.skipped ?? false });
}
