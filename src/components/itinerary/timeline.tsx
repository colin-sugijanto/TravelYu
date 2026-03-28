import { Badge } from "@/components/ui/badge";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { createGoogleMapsLink, formatIdr } from "@/lib/utils";
import type { ItineraryItem } from "@/types/domain";

interface TimelineProps {
  items: ItineraryItem[];
}

export function ItineraryTimeline({ items }: TimelineProps) {
  if (items.length === 0) {
    return (
      <Card className="p-4">
        <CardTitle>Itinerary</CardTitle>
        <CardText className="mt-2">Belum ada itinerary untuk trip ini. Coba generate ulang dari halaman comparison.</CardText>
      </Card>
    );
  }

  const grouped = items.reduce<Record<number, ItineraryItem[]>>((acc, item) => {
    if (!acc[item.day_number]) acc[item.day_number] = [];
    acc[item.day_number].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([day, dayItems]) => (
        <Card key={day} className="p-4">
          <CardTitle>Day {day}</CardTitle>
          <div className="mt-3 space-y-3">
            {dayItems
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <Badge tone={item.status === "booked_locked" ? "danger" : "brand"}>{item.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <CardText className="mt-1">{item.description}</CardText>
                  {(item.booking_url || item.location_address || item.location_lat !== null || item.location_lng !== null) ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {item.booking_url ? (
                        <a
                          href={item.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-2.5 py-1 font-semibold text-[var(--brand-strong)] hover:opacity-85"
                        >
                          Buka Link Aktivitas
                        </a>
                      ) : null}
                      {(() => {
                        const mapsUrl = createGoogleMapsLink({
                          lat: item.location_lat,
                          lng: item.location_lng,
                          address: item.location_address,
                          title: item.title,
                        });

                        if (!mapsUrl) return null;

                        return (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Lihat di Google Maps
                          </a>
                        );
                      })()}
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-soft)]">
                    <span>
                      {item.time_slot} · {item.activity_type}
                    </span>
                    <span>{formatIdr(item.est_cost_idr)}</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
