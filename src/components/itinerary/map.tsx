"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { CircleMarker, Map as LeafletMap } from "leaflet";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { createGoogleMapsLink } from "@/lib/utils";
import type { ItineraryItem } from "@/types/domain";

const geocodeCache = new Map<string, { lat: number; lng: number }>();

type MapPointItem = ItineraryItem & { location_lat: number; location_lng: number };

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

function inferZoomFromBounds(bounds: ReturnType<typeof toBoundingBox>) {
  const latSpan = Math.abs(bounds.north - bounds.south);
  const lngSpan = Math.abs(bounds.east - bounds.west);
  const span = Math.max(latSpan, lngSpan);

  if (span > 10) return 5;
  if (span > 5) return 6;
  if (span > 2) return 7;
  if (span > 1) return 8;
  if (span > 0.5) return 9;
  if (span > 0.2) return 10;
  if (span > 0.1) return 11;
  if (span > 0.05) return 12;
  return 13;
}

function ensureLeafletAssetsLoaded() {
  if (typeof document === "undefined") return;

  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  if (!document.getElementById("travelyu-leaflet-pin-style")) {
    const style = document.createElement("style");
    style.id = "travelyu-leaflet-pin-style";
    style.textContent = `
      .travelyu-map-pin-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #ef4444;
        border: 2px solid #ffffff;
        border-radius: 9999px;
        color: #ffffff;
        font-weight: 700;
        font-size: 11px;
        line-height: 1;
        width: 20px;
        min-width: 20px;
        height: 20px;
        padding: 0;
        text-align: center;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      }

      .travelyu-map-pin-label::before {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }
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
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [fallbackCoordinates, setFallbackCoordinates] = useState<Record<string, { lat: number; lng: number }>>({});
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<Record<string, CircleMarker>>({});

  const points = useMemo(
    () =>
      items
        .filter((item) => {
          if (item.location_lat !== null && item.location_lng !== null) return true;
          if (item.location_address?.trim()) return true;
          return Boolean(getMapLink(item));
        })
        .slice(0, 18),
    [items],
  );

  const pointsWithCoordinates = useMemo(
    () =>
      points
        .map((item): MapPointItem | null => {
          if (typeof item.location_lat === "number" && typeof item.location_lng === "number") {
            return {
              ...(item as ItineraryItem),
              location_lat: item.location_lat,
              location_lng: item.location_lng,
            };
          }

          const fallback = fallbackCoordinates[item.id];
          if (!fallback) return null;

          return {
            ...(item as ItineraryItem),
            location_lat: fallback.lat,
            location_lng: fallback.lng,
          };
        })
        .filter((item): item is MapPointItem => item !== null),
    [fallbackCoordinates, points],
  );

  const pointsWithCoordinatesById = useMemo(() => {
    return Object.fromEntries(pointsWithCoordinates.map((item) => [item.id, item]));
  }, [pointsWithCoordinates]);

  const geocodeTargets = useMemo(() => {
    return points
      .filter((item) => item.location_lat === null || item.location_lng === null)
      .filter((item) => !fallbackCoordinates[item.id])
      .map((item) => {
        const query = item.location_address?.trim() || item.title;
        return {
          id: item.id,
          query,
        };
      })
      .filter((item) => item.query.length > 0)
      .slice(0, 12);
  }, [fallbackCoordinates, points]);

  const geocodeTargetKey = useMemo(() => geocodeTargets.map((item) => `${item.id}:${item.query}`).join("|"), [geocodeTargets]);

  useEffect(() => {
    if (geocodeTargets.length < 1) return;

    let cancelled = false;

    const run = async () => {
      const resolved: Record<string, { lat: number; lng: number }> = {};

      for (const target of geocodeTargets) {
        if (cancelled) return;

        const cached = geocodeCache.get(target.query.toLowerCase());
        if (cached) {
          resolved[target.id] = cached;
          continue;
        }

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(target.query)}`,
            {
              headers: {
                Accept: "application/json",
              },
            },
          );

          if (!response.ok) continue;

          const data = (await response.json()) as Array<{ lat?: string; lon?: string }>;
          const first = data[0];
          if (!first?.lat || !first.lon) continue;

          const lat = Number.parseFloat(first.lat);
          const lng = Number.parseFloat(first.lon);
          if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

          const coord = { lat, lng };
          geocodeCache.set(target.query.toLowerCase(), coord);
          resolved[target.id] = coord;

          await new Promise((resolve) => setTimeout(resolve, 120));
        } catch {
          continue;
        }
      }

      if (cancelled || Object.keys(resolved).length < 1) return;

      setFallbackCoordinates((prev) => ({
        ...prev,
        ...resolved,
      }));
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [geocodeTargetKey, geocodeTargets]);

  const pointsKey = useMemo(
    () => pointsWithCoordinates.map((item) => `${item.id}:${item.location_lat}:${item.location_lng}`).join("|"),
    [pointsWithCoordinates],
  );

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

  const mapZoom = inferZoomFromBounds(mapBounds);
  const openStreetMapFallbackLink = `https://www.openstreetmap.org/?mlat=${mapBounds.centerLat}&mlon=${mapBounds.centerLng}#map=${mapZoom}/${mapBounds.centerLat}/${mapBounds.centerLng}`;

  useEffect(() => {
    if (!mapContainerRef.current || points.length < 1) return;

    let isCancelled = false;

    const initializeMap = async () => {
      ensureLeafletAssetsLoaded();
      const leafletModule = await import("leaflet");
      const L = (leafletModule.default ?? leafletModule) as typeof import("leaflet");
      if (isCancelled || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      markerRefs.current = {};

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      });

      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const latLngs = pointsWithCoordinates.map((item) => L.latLng(item.location_lat as number, item.location_lng as number));

      if (latLngs.length === 0) {
        map.setView([mapBounds.centerLat, mapBounds.centerLng], mapZoom);
      } else if (latLngs.length === 1) {
        map.setView(latLngs[0], 13);
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24], maxZoom: 13 });
      }

      pointsWithCoordinates.forEach((item, index) => {
        const marker = L.circleMarker([item.location_lat as number, item.location_lng as number], {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#ef4444",
          fillOpacity: 1,
        }).addTo(map);

        marker.bindTooltip(String(index + 1), {
          permanent: true,
          direction: "center",
          className: "travelyu-map-pin-label",
        });

        marker.on("click", () => {
          setSelectedPointId(item.id);
        });

        markerRefs.current[item.id] = marker;
      });
    };

    void initializeMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRefs.current = {};
    };
  }, [mapBounds.centerLat, mapBounds.centerLng, mapZoom, points.length, pointsKey, pointsWithCoordinates]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    for (const [id, marker] of Object.entries(markerRefs.current)) {
      const isSelected = id === selectedPointId;
      marker.setStyle({
        radius: isSelected ? 8 : 7,
        fillColor: isSelected ? "#1d4ed8" : "#ef4444",
      });
    }

    if (selectedPointId && markerRefs.current[selectedPointId]) {
      const marker = markerRefs.current[selectedPointId];
      map.panTo(marker.getLatLng(), { animate: true, duration: 0.4 });
    }
  }, [selectedPointId]);

  return (
    <Card className="p-4">
      <CardTitle>Map Overview</CardTitle>
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-3">
        {points.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            <div className="space-y-2 p-2">
              <div ref={mapContainerRef} className="h-72 w-full rounded-lg" aria-label="Interactive itinerary map" />
              <a
                href={openStreetMapFallbackLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-xs font-semibold text-[var(--brand-blue-strong)] underline-offset-2 hover:underline"
              >
                Buka peta penuh di OpenStreetMap (zoom {mapZoom})
              </a>
              {pointsWithCoordinates.length > 0 ? (
                <p className="text-[11px] text-[var(--text-soft)]">Klik pin di peta untuk menyorot lokasi pada daftar di bawah.</p>
              ) : (
                <>
                  <p className="text-[11px] font-semibold text-[var(--text)]">Koordinat belum tersedia, peta tetap ditampilkan dengan estimasi area tujuan.</p>
                  <p className="text-[11px] text-[var(--text-soft)]">Gunakan link lokasi di bawah untuk membuka navigasi Google Maps per aktivitas.</p>
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
                </>
              )}
            </div>
          </div>
        ) : (
          <CardText>No location pins available yet.</CardText>
        )}

        <div className="mt-3 grid gap-2">
          {points.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm transition ${
                selectedPointId === item.id ? "ring-2 ring-[var(--brand-blue-strong)]" : ""
              }`}
              onClick={() => {
                if (pointsWithCoordinatesById[item.id]) {
                  setSelectedPointId(item.id);
                }
              }}
            >
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
