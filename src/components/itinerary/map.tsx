import Image from "next/image";
import { MapPin } from "lucide-react";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import type { ItineraryItem } from "@/types/domain";

export function ItineraryMap({ items }: { items: ItineraryItem[] }) {
  const points = items.filter((item) => item.location_lat !== null && item.location_lng !== null).slice(0, 12);

  const lats = points.map((item) => item.location_lat as number);
  const lngs = points.map((item) => item.location_lng as number);

  const minLat = lats.length > 0 ? Math.min(...lats) : -8.4095;
  const maxLat = lats.length > 0 ? Math.max(...lats) : -8.2095;
  const minLng = lngs.length > 0 ? Math.min(...lngs) : 115.088;
  const maxLng = lngs.length > 0 ? Math.max(...lngs) : 115.288;

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const mapKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? "";

  const markerParams = points
    .map((item) => `${item.location_lng as number},${item.location_lat as number}`)
    .join("|");

  const staticMapUrl =
    markerParams && mapKey
      ? `https://api.maptiler.com/maps/streets-v2/static/auto/1200x600@2x.png?key=${encodeURIComponent(mapKey)}&markers=${encodeURIComponent(markerParams)}`
      : `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.12}%2C${centerLat - 0.08}%2C${centerLng + 0.12}%2C${centerLat + 0.08}&layer=mapnik`;

  return (
    <Card className="p-4">
      <CardTitle>Map Overview</CardTitle>
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-3">
        {points.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            {markerParams && mapKey ? (
              <Image src={staticMapUrl} alt="Trip map overview" width={1200} height={600} className="h-72 w-full object-cover" unoptimized />
            ) : (
              <iframe title="Trip map overview" src={staticMapUrl} className="h-72 w-full" loading="lazy" />
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
