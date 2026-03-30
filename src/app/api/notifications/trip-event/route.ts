import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { timingSafeEqual } from "crypto";

const allowedEvents = new Set([
  "itinerary_ready",
  "cs_approved",
  "trip_reminder_h1",
  "trip_completed",
  "post_trip_review",
  "points_earned",
  "cs_reply",
]);

export async function POST(request: Request) {
  const expected = process.env.TRAVELYU_INTERNAL_API_TOKEN;
  if (!expected) {
    console.error("TRAVELYU_INTERNAL_API_TOKEN is not configured");
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const token = request.headers.get("x-travelyu-token");
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  scheduleNotification({
    eventType: body.eventType as
      | "itinerary_ready"
      | "cs_approved"
      | "trip_reminder_h1"
      | "trip_completed"
      | "post_trip_review"
      | "points_earned"
      | "cs_reply",
    tripId: recipient.tripId,
    tripPublicId: recipient.tripPublicId,
    userName: recipient.userName,
    email: recipient.email,
    phoneE164: recipient.phoneE164,
    channelPreference: body.channelPreference ?? "both",
  });

  return Response.json({ ok: true, queued: true });
}
