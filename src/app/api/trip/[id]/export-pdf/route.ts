import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { getItineraryItems, getTripById } from "@/lib/data";
import { isTripMember } from "@/lib/trip-access";

function sanitizeForPdf(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\r\n\t]/g, "")
    .trim();
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trip = await getTripById(id);
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  const isAdmin = isAdminRole(appUser.role);
  if (!isAdmin && trip.user_id !== appUser.id) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const items = await getItineraryItems(trip?.id ?? id);

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const brandColor = rgb(0.96, 0.45, 0.17); // Orange brand color
  const darkTextColor = rgb(0.1, 0.1, 0.1);
  const lightTextColor = rgb(0.4, 0.4, 0.4);

  let cursorY = 800;

  // Header Brand
  page.drawText("TravelYu", {
    x: 40,
    y: cursorY,
    size: 28,
    font: bold,
    color: brandColor,
  });

  cursorY -= 30;

  page.drawText("Official Trip Itinerary", {
    x: 40,
    y: cursorY,
    size: 16,
    font: bold,
    color: darkTextColor,
  });

  cursorY -= 20;

  page.drawText(`Trip Code: ${sanitizeForPdf(trip?.public_id ?? id)}`, {
    x: 40,
    y: cursorY,
    size: 12,
    font,
    color: lightTextColor,
  });

  cursorY -= 40;

  let currentDay = -1;

  for (const item of items) {
    if (cursorY < 100) {
      page = pdf.addPage([595, 842]);
      cursorY = 800;
    }

    if (item.day_number !== currentDay) {
      currentDay = item.day_number;
      page.drawText(`Day ${currentDay}`, {
        x: 40,
        y: cursorY,
        size: 14,
        font: bold,
        color: brandColor,
      });
      cursorY -= 20;
    }

    const titleText = sanitizeForPdf(`${item.time_slot.toUpperCase()} - ${item.title}`);
    page.drawText(titleText, {
      x: 40,
      y: cursorY,
      size: 11,
      font: bold,
      color: darkTextColor,
    });

    cursorY -= 15;
    const descText = sanitizeForPdf(item.description);
    page.drawText(descText, {
      x: 40,
      y: cursorY,
      size: 10,
      font,
      color: lightTextColor,
      maxWidth: 515,
    });

    // Approximate height for description
    const lines = Math.max(1, Math.ceil(descText.length / 90));
    cursorY -= (15 * lines) + 15;
  }

  // Footer on all pages
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText(`Page ${i + 1} of ${pages.length} · Created by TravelYu AI`, {
      x: 40,
      y: 30,
      size: 9,
      font,
      color: lightTextColor,
    });
  }

  const bytes = await pdf.save();
  const arrayBuffer = new ArrayBuffer(bytes.length);
  new Uint8Array(arrayBuffer).set(bytes);

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${trip?.public_id ?? id}-itinerary.pdf"`,
    },
  });
}
