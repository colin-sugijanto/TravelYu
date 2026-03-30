"use client";

import { MapPin } from "lucide-react";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { createGoogleMapsLink } from "@/lib/utils";
import type { ItineraryItem } from "@/types/domain";

function ensureValidHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

function isMapProviderUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    if (host.includes("maps.app.goo.gl")) return true;
    if (host.includes("google.com") && path.includes("/maps")) return true;
    if (host.includes("openstreetmap.org")) return true;

    return false;
  } catch {
    return false;
  }
}

function getMapLink(item: ItineraryItem) {
  const derivedMapLink = createGoogleMapsLink({
    lat: item.location_lat,
    lng: item.location_lng,
    address: item.location_address,
    title: item.title,
  });

  if (derivedMapLink) return derivedMapLink;

  const bookingUrl = ensureValidHttpUrl(item.booking_url);
  if (!bookingUrl) return null;

  return isMapProviderUrl(bookingUrl) ? bookingUrl : null;
}

function toBoundingBox(pointsWithCoordinates: ItineraryItem[]) {
  const lats = pointsWithCoordinates.map((item) => item.location_lat as number);
  const lngs = pointsWithCoordinates.map((item) => item.location_lng as number);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latPadding = Math.max((maxLat - minLat) * 0.25, 0.04);
  const lngPadding = Math.max((maxLng - minLng) * 0.25, 0.05);

  const south = minLat - latPadding;
  const north = maxLat + latPadding;
  const west = minLng - lngPadding;
  const east = maxLng + lngPadding;

  return {
    south,
    west,
    north,
    east,
    centerLat: (south + north) / 2,
    centerLng: (west + east) / 2,
  };
}

function getActivityLink(item: ItineraryItem) {
  const bookingUrl = ensureValidHttpUrl(item.booking_url);
  if (bookingUrl && !isMapProviderUrl(bookingUrl)) return bookingUrl;
  return null;
}

function getActivityLinkLabel(item: ItineraryItem) {
  const text = `${item.title} ${item.description}`.toLowerCase();

  if (
    item.activity_type === "transport" &&
    (text.includes("flight") || text.includes("penerbangan") || text.includes("airport") || text.includes("bandara"))
  ) {
    return "Website Tiket Penerbangan";
  }

  if (item.activity_type === "accommodation") return "Website Hotel";
  if (item.activity_type === "dining") return "Website Restoran";
  if (item.activity_type === "transport") return "Website Transport";
  return "Website Aktivitas";
}

export function ItineraryMap({ items }: { items: ItineraryItem[] }) {
  const pointsWithCoordinates = items
    .filter((item) => item.location_lat !== null && item.location_lng !== null)
    .slice(0, 18);

  const points = items
    .filter((item) => {
      if (item.location_lat !== null && item.location_lng !== null) return true;
      if (item.location_address?.trim()) return true;
      return Boolean(getMapLink(item));
    })
    .slice(0, 18);

  const firstAvailableMapLink = points
    .map((item) => getMapLink(item))
    .find((url): url is string => Boolean(url));

  const mapBounds =
    pointsWithCoordinates.length > 0
      ? toBoundingBox(pointsWithCoordinates)
      : {
          south: -8.52,
          west: 114.92,
          north: -8.02,
          east: 115.42,
          centerLat: -8.27,
          centerLng: 115.17,
        };

  const openStreetMapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapBounds.west}%2C${mapBounds.south}%2C${mapBounds.east}%2C${mapBounds.north}&layer=mapnik`;
  const openStreetMapFallbackLink = `https://www.openstreetmap.org/?mlat=${mapBounds.centerLat}&mlon=${mapBounds.centerLng}#map=11/${mapBounds.centerLat}/${mapBounds.centerLng}`;

  return (
    <Card className="p-4">
      <CardTitle>Map Overview</CardTitle>
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-3">
        {points.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            {pointsWithCoordinates.length > 0 ? (
              <div className="space-y-2 p-2">
                <iframe title="Trip map overview" src={openStreetMapEmbedUrl} className="h-72 w-full rounded-lg" loading="lazy" />
                <a
                  href={openStreetMapFallbackLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-xs font-semibold text-[var(--brand-blue-strong)] underline-offset-2 hover:underline"
                >
                  Buka peta penuh di OpenStreetMap
                </a>
              </div>
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-2 px-5 text-center">
                <p className="text-sm font-semibold text-[var(--text)]">Koordinat belum tersedia untuk itinerary ini.</p>
                <p className="text-xs text-[var(--text-soft)]">TravelYu tetap menyiapkan link peta per aktivitas di daftar bawah.</p>
                {firstAvailableMapLink ? (
                  <a
                    href={firstAvailableMapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-xs font-semibold text-[var(--brand-blue-strong)] underline-offset-2 hover:underline"
                  >
                    Buka lokasi pertama di Google Maps
                  </a>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <CardText>No location pins available yet.</CardText>
        )}

        <div className="mt-3 grid gap-2">
          {points.map((item) => (
            <div key={item.id} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 text-[var(--brand)]" />
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-[var(--text-soft)]">{item.location_address ?? "Unknown"}</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {(() => {
                    const activityLink = getActivityLink(item);
                    if (!activityLink) return null;

                    return (
                      <a
                        href={activityLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-xs font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
                      >
                        {getActivityLinkLabel(item)}
                      </a>
                    );
                  })()}
                  {(() => {
                    const mapsUrl = getMapLink(item);

                    if (!mapsUrl) return null;

                    return (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-xs font-semibold text-[var(--brand-blue-strong)] underline-offset-2 hover:underline"
                      >
                        Lihat di Google Maps
                      </a>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
