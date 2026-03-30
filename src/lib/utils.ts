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

  const normalize = (value: string | null | undefined) => value?.trim().replace(/\s+/g, " ") ?? "";

  const splitRoute = (value: string) => {
    const match = /(.+?)\s+to\s+(.+)/i.exec(value);
    if (!match) return null;

    const origin = match[1]?.trim();
    const destination = match[2]?.trim();
    if (!origin || !destination) return null;

    return { origin, destination };
  };

  const normalizedTitle =
    normalize(title)
      .replace(/^hidden\s+gem:\s*/i, "")
      .replace(/^flight\s+to\s+/i, "")
      .replace(/^arrival\s+and\s+transfer\s*/i, "")
      .replace(/^departure\s+transfer\s*/i, "")
      .replace(/^arrival\s+at\s+/i, "")
      .replace(/^departure\s+to\s+/i, "")
      .replace(/^transfer\s+to\s+/i, "")
      .replace(/^(lunch|dinner|breakfast|brunch|meal)\s+at\s+/i, "")
      .replace(/^(check-?in|check in|stay)\s+at\s+/i, "")
      .replace(/^(sunset\s+dining|dining)\s+at\s+/i, "")
      .replace(/^(relax|explore|exploration|visit)\s+at\s+/i, "")
      .trim() || "";
  const normalizedAddress = normalize(address);

  const routeFromAddress = splitRoute(normalizedAddress);
  const routeFromTitle = splitRoute(normalizedTitle);
  const route = routeFromAddress ?? routeFromTitle;

  if (route) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(route.origin)}&destination=${encodeURIComponent(route.destination)}`;
  }

  const queryCandidates = [
    normalizedTitle && normalizedAddress ? `${normalizedTitle}, ${normalizedAddress}` : "",
    normalizedTitle,
    normalizedAddress,
  ];

  for (const candidate of queryCandidates) {
    const query = candidate.trim();
    if (!query) continue;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  if (typeof lat === "number" && typeof lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  return null;
}
