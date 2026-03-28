export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatIdr(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function tierFromPoints(points: number) {
  if (points >= 2000) return "wanderer" as const;
  if (points >= 500) return "adventurer" as const;
  return "explorer" as const;
}

export function isMajorChange(input: {
  destinationChanged?: boolean;
  dateChanged?: boolean;
  hotelChanged?: boolean;
}) {
  return Boolean(input.destinationChanged || input.dateChanged || input.hotelChanged);
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Builds a human-readable trip label from intake data.
 * Format: "Lokasi · Tanggal" or just "Lokasi" or falls back to public_id.
 */
export function formatTripName(trip: {
  public_id: string;
  intake_data?: {
    where?: string;
    when?: string;
  } | null;
}): string {
  const where = trip.intake_data?.where?.trim();
  const when = trip.intake_data?.when?.trim();

  if (where && when) return `${where} · ${when}`;
  if (where) return where;
  return trip.public_id;
}

export function createGoogleMapsLink(input: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  title?: string | null;
}) {
  const { lat, lng, address, title } = input;

  if (typeof lat === "number" && typeof lng === "number") {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  const query = address?.trim() || title?.trim();
  if (!query) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
