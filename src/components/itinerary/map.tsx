import Image from "next/image";
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

export function ItineraryMap({ items }: { items: ItineraryItem[] }) {
  const pointsWithCoordinates = items
    .filter((item) => item.location_lat !== null && item.location_lng !== null)
    .slice(0, 12);

  const points = items
    .filter((item) => {
      if (item.location_lat !== null && item.location_lng !== null) return true;
      if (item.location_address?.trim()) return true;
      return Boolean(getMapLink(item));
    })
    .slice(0, 12);

  const firstAvailableMapLink = points
    .map((item) => getMapLink(item))
    .find((url): url is string => Boolean(url));

  const lats = pointsWithCoordinates.map((item) => item.location_lat as number);
  const lngs = pointsWithCoordinates.map((item) => item.location_lng as number);

  const minLat = lats.length > 0 ? Math.min(...lats) : -8.4095;
  const maxLat = lats.length > 0 ? Math.max(...lats) : -8.2095;
  const minLng = lngs.length > 0 ? Math.min(...lngs) : 115.088;
  const maxLng = lngs.length > 0 ? Math.max(...lngs) : 115.288;

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const mapKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? "";

  const markerParams = pointsWithCoordinates
    .map((item) => `${item.location_lng as number},${item.location_lat as number}`)
    .join("|");

  const staticMapUrl =
    markerParams && mapKey
      ? `https://api.maptiler.com/maps/streets-v2/static/auto/1200x600@2x.png?key=${encodeURIComponent(mapKey)}&markers=${encodeURIComponent(markerParams)}`
      : `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.12}%2C${centerLat - 0.08}%2C${centerLng + 0.12}%2C${centerLat + 0.08}&layer=mapnik`;

  const openStreetMapFallbackLink = `https://www.openstreetmap.org/?mlat=${centerLat}&mlon=${centerLng}#map=11/${centerLat}/${centerLng}`;

  return (
    <Card className="p-4">
      <CardTitle>Map Overview</CardTitle>
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-3">
        {points.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            {pointsWithCoordinates.length > 0 && markerParams && mapKey ? (
              <Image src={staticMapUrl} alt="Trip map overview" width={1200} height={600} className="h-72 w-full object-cover" unoptimized />
            ) : pointsWithCoordinates.length > 0 ? (
              <div className="space-y-2 p-2">
                <iframe title="Trip map overview" src={staticMapUrl} className="h-72 w-full rounded-lg" loading="lazy" />
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
                {(() => {
                  const mapsUrl = getMapLink(item);

                  if (!mapsUrl) return null;

                  return (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex text-xs font-semibold text-[var(--brand-blue-strong)] underline-offset-2 hover:underline"
                    >
                      Lihat di Google Maps
                    </a>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
