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
  /** Item IDs locked by real tickets (AI planned around them) */
  anchorItemIds?: string[];
}

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

function getActivityLinkLabel(item: ItineraryItem) {
  const text = `${item.title} ${item.description}`.toLowerCase();

  if (
    item.activity_type === "transport" &&
    (text.includes("flight") || text.includes("penerbangan") || text.includes("airport") || text.includes("bandara"))
  ) {
    return "Buka Tiket Penerbangan";
  }

  if (item.activity_type === "accommodation") return "Buka Website Hotel";
  if (item.activity_type === "dining") return "Buka Website Restoran";
  if (item.activity_type === "transport") return "Buka Website Transport";
  return "Buka Website Lokasi";
}

const STATUS_LABELS: Record<string, string> = {
  booked_locked: "Terkunci",
  planned: "Terencana",
  confirmed: "Dikonfirmasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

function formatItemStatus(status: string) {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
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
    const confirmed = window.confirm(
      `Regen ulang Day ${dayNumber}? Ini memakai ±5 kredit AI dan menyusun ulang aktivitas hari tersebut.`,
    );
    if (!confirmed) return;
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
  anchorItemIds = [],
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
                  {(() => {
                    const bookingUrl = ensureValidHttpUrl(item.booking_url);
                    const activityWebsiteUrl = bookingUrl && !isMapProviderUrl(bookingUrl) ? bookingUrl : null;
                    const mapAddress = item.location_address ?? undefined;
                    const mapsUrl = createGoogleMapsLink({
                      lat: item.location_lat,
                      lng: item.location_lng,
                      address: mapAddress,
                      title: item.title,
                    }) ?? (bookingUrl && isMapProviderUrl(bookingUrl) ? bookingUrl : null);

                    return (
                      <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                      <span>{item.title}</span>
                      {anchorItemIds.includes(item.id) ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800" title="Dikunci oleh tiket asli — AI menyusun di sekitar jadwal ini">
                          🔒 Tiket asli
                        </span>
                      ) : null}
                    </p>
                    <Badge tone={item.status === "booked_locked" ? "danger" : "brand"}>{formatItemStatus(item.status)}</Badge>
                  </div>
                  <CardText className="mt-1">{item.description}</CardText>
                  {(activityWebsiteUrl || mapsUrl) ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {activityWebsiteUrl ? (
                        <a
                          href={activityWebsiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-2.5 py-1 font-semibold text-[var(--brand-strong)] hover:opacity-85"
                        >
                          {getActivityLinkLabel(item)}
                        </a>
                      ) : null}
                      {mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Lihat di Google Maps
                        </a>
                      ) : null}
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
                      </>
                    );
                  })()}
                </div>
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
