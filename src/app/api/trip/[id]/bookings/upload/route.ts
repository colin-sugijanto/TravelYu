import { revalidateTag } from "next/cache";

import { getCurrentAppUser } from "@/lib/auth";
import { checkBookingCreationAllowed } from "@/lib/entitlements";
import { fallbackParseBooking } from "@/lib/booking-parser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";
import type { BookingType } from "@/types/domain";

const VALID_TYPES: BookingType[] = ["flight", "train", "hotel", "ferry", "bus", "activity", "other"];
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
]);
const MAX_BYTES = 10 * 1024 * 1024;

function sanitizeFileName(input: string, fallbackExt: string) {
  const rawExt = input.includes(".") ? (input.split(".").pop()?.toLowerCase() ?? "") : "";
  const safeExt = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "txt"].includes(rawExt) ? rawExt : fallbackExt;
  const random = crypto.randomUUID().split("-")[0];
  return `${Date.now()}-${random}.${safeExt}`;
}

/**
 * POST /api/trip/[id]/bookings/upload — seamless ticket import.
 * multipart/form-data: file (pdf/image, required, stored in Supabase Storage `trip-tickets`),
 * optional: rawText (for AI/fallback prefill), plus optional parsed overrides
 * (title, booking_type, provider, booking_ref, origin, destination, depart_at...).
 * Creates the booking row with file_url in one shot.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await findTripByIdentifier<{ id: string; user_id: string }>(id, "id,user_id");
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  if (trip.user_id !== appUser.id) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const gate = await checkBookingCreationAllowed(trip.id, appUser.id);
  if (!gate.ok) return Response.json({ error: gate.error, code: "PLAN_LIMIT", upgradeUrl: "/plans" }, { status: 402 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Form data tidak valid." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "File tiket wajib diunggah (PDF/gambar)." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File terlalu besar (maks 10MB)." }, { status: 400 });

  const mime = (file.type || "").toLowerCase();
  const nameLower = (file.name || "").toLowerCase();
  const looksAllowed =
    ALLOWED_MIME.has(mime) ||
    nameLower.endsWith(".pdf") ||
    nameLower.endsWith(".jpg") ||
    nameLower.endsWith(".jpeg") ||
    nameLower.endsWith(".png") ||
    nameLower.endsWith(".webp");
  if (!looksAllowed) {
    return Response.json({ error: "Format file harus PDF atau gambar (JPG/PNG/WebP)." }, { status: 400 });
  }

  const getStr = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v.trim() : "";
  };

  // Prefill via deterministic parser when caller supplies rawText (e.g. copy-paste or PDF text extraction client-side)
  const rawText = getStr("rawText");
  const prefill = rawText.length >= 4 ? fallbackParseBooking(rawText.slice(0, 8000)) : null;

  const title = getStr("title") || prefill?.title || file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || "Tiket perjalanan";
  const bookingTypeRaw = getStr("booking_type") as BookingType;
  const booking_type = VALID_TYPES.includes(bookingTypeRaw) ? bookingTypeRaw : (prefill?.booking_type ?? "other");

  // Upload to Supabase Storage `trip-tickets` (single source of truth for files)
  const fallbackExt = mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const safeName = sanitizeFileName(file.name || `ticket.${fallbackExt}`, fallbackExt);
  const storagePath = `${trip.id}/${safeName}`;

  try {
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage.from("trip-tickets").upload(storagePath, bytes, {
      contentType: file.type || (fallbackExt === "pdf" ? "application/pdf" : `image/${fallbackExt}`),
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from("trip-tickets").getPublicUrl(storagePath);
    const fileUrl = publicUrlData?.publicUrl ?? null;

    const orNull = (v: string) => (v ? v.slice(0, 200) : null);
    const row = {
      trip_id: trip.id,
      user_id: appUser.id,
      booking_type,
      provider: orNull(getStr("provider")) ?? prefill?.provider ?? null,
      booking_ref: orNull(getStr("booking_ref"))?.toUpperCase() ?? prefill?.booking_ref ?? null,
      title: title.slice(0, 200),
      origin: orNull(getStr("origin")) ?? prefill?.origin ?? null,
      destination: orNull(getStr("destination")) ?? prefill?.destination ?? null,
      depart_at: getStr("depart_at") || prefill?.depart_at || null,
      arrive_at: getStr("arrive_at") || prefill?.arrive_at || null,
      check_in: getStr("check_in") || prefill?.check_in || null,
      check_out: getStr("check_out") || prefill?.check_out || null,
      details: {
        ...(prefill?.details ?? {}),
        originalFileName: file.name.slice(0, 120),
        mimeType: file.type || null,
        hasRawText: rawText.length > 0,
      },
      file_url: fileUrl,
      linked_item_id: getStr("linked_item_id") || null,
    };

    const { data: booking, error: dbError } = await supabaseAdmin.from("trip_bookings").insert(row).select("*").single();
    if (dbError) throw dbError;

    revalidateTag(`trip:${trip.id}`, "max");
    return Response.json({ ok: true, booking, fileUrl, storagePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengunggah tiket.";
    if (/does not exist|bucket|relation/i.test(message)) {
      return Response.json(
        { error: "Storage trip-tickets belum tersedia. Jalankan migrasi 017 terlebih dahulu." },
        { status: 500 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
