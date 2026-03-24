import { MapPin } from "lucide-react";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import type { ItineraryItem } from "@/types/domain";

export function ItineraryMap({ items }: { items: ItineraryItem[] }) {
  const points = items.filter((item) => item.location_lat && item.location_lng).slice(0, 6);

  return (
    <Card className="p-4">
      <CardTitle>Map Overview</CardTitle>
      <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-alt)] p-3">
        <CardText>
          Integrasi mapbox/leaflet siap dipasang. Saat ini menampilkan daftar pin itinerary yang berasal dari data lat/lng.
        </CardText>
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
