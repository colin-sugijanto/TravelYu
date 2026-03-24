import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getItineraryItems, getTripById } from "@/lib/data";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await getTripById(id);
  const items = await getItineraryItems(trip?.id ?? id);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("TravelYu Itinerary", {
    x: 40,
    y: 800,
    size: 22,
    font: bold,
    color: rgb(0.08, 0.2, 0.15),
  });

  page.drawText(`Trip: ${trip?.public_id ?? id}`, {
    x: 40,
    y: 774,
    size: 12,
    font,
    color: rgb(0.2, 0.3, 0.24),
  });

  let cursorY = 744;
  for (const item of items.slice(0, 24)) {
    if (cursorY < 60) break;

    page.drawText(`Day ${item.day_number} · ${item.time_slot} · ${item.title}`, {
      x: 40,
      y: cursorY,
      size: 10,
      font: bold,
      color: rgb(0.1, 0.2, 0.15),
    });

    cursorY -= 12;
    page.drawText(item.description, {
      x: 48,
      y: cursorY,
      size: 9,
      font,
      color: rgb(0.24, 0.33, 0.29),
      maxWidth: 500,
    });

    cursorY -= 22;
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
