import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { resolveTripRecipient, scheduleNotification } from "@/lib/notifications";
import { scheduleAwardPoints } from "@/lib/points";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";
import { revalidateTag } from "next/cache";

function sanitizeFileName(input: string): string {
  const ext = input.includes(".") ? input.split(".").pop()?.toLowerCase() : "jpg";
  const safeExt = ext && ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? ext : "jpg";
  const timestamp = Date.now();
  const random = crypto.randomUUID().split("-")[0];
  return `${timestamp}-${random}.${safeExt}`;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== appUser.id) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: photos, error } = await supabaseAdmin
    .from("trip_photos")
    .select("id,trip_id,user_id,storage_path,caption,uploaded_at")
    .eq("trip_id", trip.id)
    .order("uploaded_at", { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ error: "Failed to fetch photos" }, { status: 500 });
  }

  const normalized = await Promise.all(
    (photos ?? []).map(async (photo) => {
      const { data } = supabaseAdmin.storage.from("trip-photos").getPublicUrl(photo.storage_path);
      return {
        ...photo,
        publicUrl: data.publicUrl,
      };
    }),
  );

  return Response.json({ photos: normalized });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  const isOwner = trip.user_id === appUser.id;
  if (!isOwner) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { checkPhotoUploadAllowed } = await import("@/lib/entitlements");
  const photoGate = await checkPhotoUploadAllowed(trip.id, appUser.id);
  if (!photoGate.ok) {
    return Response.json({ error: photoGate.error, code: "PLAN_LIMIT", upgradeUrl: "/plans" }, { status: 402 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const caption = String(formData.get("caption") ?? "").trim();

  if (!(file instanceof File)) {
    return Response.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  const safeName = sanitizeFileName(file.name || "photo.jpg");
  const path = `${trip.id}/${Date.now()}-${safeName}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage.from("trip-photos").upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return Response.json({ error: "Failed to upload photo" }, { status: 500 });
  }

  const { error: insertError } = await supabaseAdmin.from("trip_photos").insert({
    trip_id: trip.id,
    user_id: appUser.id,
    storage_path: path,
    caption: caption || null,
  });

  if (insertError) {
    return Response.json({ error: "Failed to save photo metadata" }, { status: 500 });
  }

  revalidateTag(`trip:${trip.id}:photos`, "max");

  // Award 10 points per photo, capped at the first 20 photos per trip
  const { count: photoCount } = await supabaseAdmin
    .from("trip_photos")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .eq("user_id", appUser.id);

  if ((photoCount ?? 0) <= 20) {
    scheduleAwardPoints(appUser.id, 10, "photo_upload", trip.id as string);

    const recipient = await resolveTripRecipient(trip.id as string);
    if (recipient) {
      scheduleNotification({
        eventType: "points_earned",
        tripId: recipient.tripId,
        tripPublicId: recipient.tripPublicId,
        userName: recipient.userName,
        email: recipient.email,
        phoneE164: recipient.phoneE164,
        channelPreference: "both",
        subject: "+10 poin dari upload foto",
        emailText: "Foto perjalanan berhasil diupload. Kamu mendapatkan +10 poin loyalty TravelYu.",
        waText: "Foto berhasil diupload! Kamu dapat +10 poin loyalty TravelYu ✨",
      });
    }
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const photoId = searchParams.get("photoId");

  if (!photoId) {
    return Response.json({ error: "photoId is required" }, { status: 400 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  const { data: photo } = await supabaseAdmin
    .from("trip_photos")
    .select("id,user_id,storage_path")
    .eq("id", photoId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!photo) {
    return Response.json({ error: "Photo not found" }, { status: 404 });
  }

  if (photo.user_id !== appUser.id && trip.user_id !== appUser.id && !isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await Promise.all([
    supabaseAdmin.storage.from("trip-photos").remove([photo.storage_path]),
    supabaseAdmin.from("trip_photos").delete().eq("id", photo.id),
  ]);

  revalidateTag(`trip:${trip.id}:photos`, "max");

  return Response.json({ ok: true });
}
