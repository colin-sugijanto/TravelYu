"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { createGoogleMapsLink, formatIdr } from "@/lib/utils";
import type { ItineraryItem } from "@/types/domain";
import { VendorModal } from "./vendor-modal";

interface TimelineProps {
  items: ItineraryItem[];
  tripId: string;
  /** Allow regen button — only for approved/active trips owned by the user */
  canRegen?: boolean;
  /** Show internal vendor detail modal */
  allowVendorDetails?: boolean;
}

function RegenDayButton({ tripId, dayNumber }: { tripId: string; dayNumber: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const REQUEST_TIMEOUT_MS = 45000;

  useEffect(() => {
    if (!done) return;

    const timer = window.setTimeout(() => {
      setDone(false);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [done]);

  const handleRegen = () => {
    if (pending) return;
    setError(null);
    setPending(true);
    void (async () => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => {
          controller.abort();
        }, REQUEST_TIMEOUT_MS);

        const res = await fetch(`/api/trip/${tripId}/regen-day`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dayNumber }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          setError(json.error ?? "Regen gagal.");
          return;
        }
        setDone(true);
        setError(null);
        router.refresh();
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          setError("Regen memakan waktu terlalu lama. Coba lagi sebentar.");
        } else {
          setError("Terjadi kesalahan. Coba lagi.");
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setPending(false);
      }
    })();
  };

  if (done) {
    return (
      <span className="text-xs font-medium text-green-600">✅ Hari ini sudah diregen</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRegen}
        disabled={pending}
        className="rounded-full border border-[var(--brand)]/40 bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand-strong)] transition hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "⏳ Sedang meregen..." : "🔄 Regen hari ini"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function ItineraryTimeline({
  items,
  tripId,
  canRegen = false,
  allowVendorDetails = true,
}: TimelineProps) {
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Day {day}</CardTitle>
            {canRegen && (
              <RegenDayButton tripId={tripId} dayNumber={Number(day)} />
            )}
          </div>
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
                      {allowVendorDetails && item.source === "internal_db" && item.vendor_id ? (
                        <VendorModal vendorId={item.vendor_id} tripId={tripId} />
                      ) : item.source === "internal_db" ? (
                        <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 text-emerald-700 border border-emerald-200">verified</span>
                      ) : null}
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
