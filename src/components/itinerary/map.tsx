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

  const latPadding = Math.max((maxLat - minLat) * 0.2, 0.06);
  const lngPadding = Math.max((maxLng - minLng) * 0.2, 0.06);

  const bbox = [
    minLng - lngPadding,
    minLat - latPadding,
    maxLng + lngPadding,
    maxLat + latPadding,
  ].join(",");

  return (
    <Card className="p-4">
      <CardTitle>Map Overview</CardTitle>
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-3">
        {points.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            <iframe
              title="Trip map overview"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`}
              className="h-72 w-full"
              loading="lazy"
            />
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
