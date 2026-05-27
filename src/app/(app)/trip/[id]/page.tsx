import { Suspense } from "react";
import Link from "next/link";

import { BudgetTracker } from "@/components/itinerary/budget-tracker";
import { EditorChat } from "@/components/itinerary/editor-chat";
import { ItineraryMap } from "@/components/itinerary/map";
import { ItineraryTimeline } from "@/components/itinerary/timeline";
import { TripLiveChat } from "@/components/trip/live-chat";
import { TripStatusWatcher } from "@/components/trip/trip-status-watcher";
import { GeneratingPoller } from "@/components/trip/generating-poller";
import { TripActionBanner } from "@/components/trip/trip-action-banner";
import { GeneratingProgressClient } from "@/components/trip/generating-progress";
import { Card, CardTitle } from "@/components/ui/card";
import { WeatherBanner } from "@/components/weather/weather-banner";
import { getCurrentAppUser } from "@/lib/auth";
import { getItineraryItems, getTripById } from "@/lib/data";
import { formatTripName } from "@/lib/utils";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, MapPin, MessageSquare, RefreshCw } from "lucide-react";
import { RefreshButton } from "@/components/trip/refresh-button";

const LOCATION_NOISE_RE = /^(jl\.?|jalan|street|st\.?|no\.?|rt\/?rw|kec\.?|kel\.?|hotel|villa|resort|airport|bandara|terminal|station|stasiun|pelabuhan)\b/i;
const LOCATION_BLACKLIST = new Set(["indonesia", "id", "ri"]);
const ADDRESS_NOISE_RE = /airport|bandara|international|international airport|stasiun|terminal|pelabuhan|harbour|harbor|port\b/i;
const TITLE_NOISE_RE = /^(arrival|departure|check-?in|check-?out|transfer|hidden gem|explore|visit|relax)\b/i;


function cleanCityToken(value: string | null | undefined) {
  if (!value) return null;

  const cleaned = value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(kota|kabupaten|city|provinsi|kota administrasi)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;
  if (/\d/.test(cleaned)) return null;
  if (LOCATION_NOISE_RE.test(cleaned)) return null;

  const lower = cleaned.toLowerCase();
  if (LOCATION_BLACKLIST.has(lower)) return null;

  return cleaned;
}

function isLocationNoise(value: string | null | undefined) {
  if (!value) return true;
  return ADDRESS_NOISE_RE.test(value);
}

function parseDestinationCity(where: string | null | undefined) {
  if (!where) return null;

  const normalized = where
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const routeMatch = /.+\bto\b\s+(.+)/i.exec(normalized);
  const target = (routeMatch?.[1] ?? normalized).trim();

  const commaParts = target
    .split(",")
    .map((part) => cleanCityToken(part))
    .filter((part): part is string => Boolean(part));

  if (commaParts.length > 0) return commaParts[0];

  const separators = /[|/;\-]/;
  const head = target.split(separators)[0]?.trim() ?? "";
  const cleanedHead = cleanCityToken(head);
  if (cleanedHead && !isLocationNoise(cleanedHead) && !TITLE_NOISE_RE.test(cleanedHead)) {
    const words = cleanedHead.split(/\s+/).filter(Boolean);
    if (words.length > 0) return words.slice(0, 3).join(" ");
  }

  return null;
}

function parseCityFromAddress(address: string | null | undefined) {
  if (!address) return null;

  if (ADDRESS_NOISE_RE.test(address)) return null;

  const parts = address
    .split(",")
    .map((part) => cleanCityToken(part))
    .filter((part): part is string => Boolean(part));

  if (parts.length <= 1) return null;

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const candidate = parts[index];
    if (!candidate) continue;
    if (isLocationNoise(candidate)) continue;
    return candidate;
  }

  return null;
}

function stripTitleNoise(value: string | null | undefined) {
  if (!value) return null;
  const stripped = value
    .replace(TITLE_NOISE_RE, "")
    .replace(/^[\s:–—-]+/, "")
    .replace(/^(in|at|to|from|di|ke|dari|pada)\s+/i, "")
    .trim();
  return stripped.length > 0 ? stripped : null;
}

async function getWeatherCity(tripId: string, where: string | null | undefined) {
  const fromIntake = parseDestinationCity(where);
  if (fromIntake) return fromIntake;

  const items = await getItineraryItems(tripId);
  for (const item of items) {
    const fromAddress = parseCityFromAddress(item.location_address);
    if (fromAddress) return fromAddress;

    const strippedTitle = stripTitleNoise(item.title);
    const fromTitle = parseDestinationCity(strippedTitle);
    if (fromTitle) return fromTitle;
  }

  return "Indonesia";
}

async function TimelineSection({
  tripId,
  canRegen,
}: {
  tripId: string;
  canRegen?: boolean;
}) {
  const items = await getItineraryItems(tripId);
  return <ItineraryTimeline items={items} tripId={tripId} canRegen={canRegen} />;
}


async function MapSection({ tripId }: { tripId: string }) {
  const items = await getItineraryItems(tripId);
  return <ItineraryMap items={items} />;
}

async function BudgetSection({ tripId, totalBudget }: { tripId: string; totalBudget: number }) {
  const items = await getItineraryItems(tripId);
  return <BudgetTracker totalBudgetIdr={totalBudget} items={items} />;
}

function TimelineSkeleton() {
  return (
    <Card className="p-4">
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-24 rounded-xl bg-[var(--bg-alt)]" />
        ))}
      </div>
    </Card>
  );
}

function PanelSkeleton() {
  return (
    <Card className="p-4">
      <div className="h-72 rounded-xl bg-[var(--bg-alt)] animate-pulse" />
    </Card>
  );
}

const STATUS_INFO: Record<string, { label: string; desc: string; color: string }> = {
  intake: {
    label: "Perencanaan Belum Selesai",
    desc: "Kamu belum menyelesaikan percakapan intake dengan AI. Lanjutkan untuk mendapatkan opsi trip.",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  payment_pending: {
    label: "Menunggu Pembayaran",
    desc: "Trip ini menunggu konfirmasi pembayaran planning fee.",
    color: "bg-yellow-50 border-yellow-200 text-yellow-800",
  },
  generating: {
    label: "Sedang Diproses AI",
    desc: "Itinerary sedang digenerate oleh AI. Halaman ini akan update otomatis dalam beberapa menit.",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  draft: {
    label: "Draft — Menunggu Persetujuan",
    desc: "Itinerary sudah dibuat. Menunggu review dari tim TravelYu sebelum bisa diakses.",
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  approved: {
    label: "Disetujui ✓",
    desc: "Itinerary sudah disetujui! Kamu bisa langsung cek detail perjalananmu.",
    color: "bg-green-50 border-green-200 text-green-800",
  },
  active: {
    label: "Perjalanan Aktif 🚀",
    desc: "Trip sedang berjalan. Selamat menikmati perjalananmu!",
    color: "bg-teal-50 border-teal-200 text-teal-800",
  },
  completed: {
    label: "Selesai ✨",
    desc: "Trip selesai! Bagikan pengalamanmu dan dapatkan poin rewards.",
    color: "bg-zinc-50 border-zinc-200 text-zinc-700",
  },
};

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    redirect(`/login?next=${encodeURIComponent(`/trip/${id}`)}`);
  }

  const trip = await getTripById(id);
  if (!trip) {
    redirect("/dashboard");
  }

  const isOwner = trip.user_id === appUser.id;
  if (!isOwner) {
    const { data: member } = await supabaseAdmin
      .from("group_trip_members")
      .select("trip_id")
      .eq("trip_id", trip.id)
      .eq("user_id", appUser.id)
      .maybeSingle();

    if (!member) {
      redirect("/dashboard");
    }
  }

  const tripName = formatTripName(trip);
  const isWorkspaceReady = trip.status === "approved" || trip.status === "active" || trip.status === "completed";
  const statusInfo = STATUS_INFO[trip.status];

  const destinationCity = await getWeatherCity(trip.id, trip.intake_data?.where);
  const totalBudget = trip.total_est_cost_idr ?? 15000000;

  return (
    <div className="space-y-4">
      {/* Realtime status watcher — replaces the old GeneratingPoller */}
      {trip.status === "generating" && (
        <>
          <TripStatusWatcher tripId={trip.id} initialStatus={trip.status} />
          <GeneratingPoller />
        </>
      )}

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
              <MapPin className="w-3 h-3" />
              <span className="font-mono">{trip.public_id}</span>
            </div>
            <CardTitle className="text-xl">{tripName}</CardTitle>
            {trip.intake_data?.who && (
              <p className="text-sm text-zinc-500 mt-1">👥 {trip.intake_data.who}</p>
            )}
          </div>

          {/* Status badge */}
          <span className={`self-start sm:self-auto inline-flex px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border ${statusInfo?.color ?? "bg-slate-100 border-slate-200 text-slate-600"}`}>
            {statusInfo?.label ?? trip.status}
          </span>
          <span className="sr-only" data-testid="trip-status">{statusInfo?.label ?? trip.status}</span>
        </div>
      </Card>

      {/* Status gate — shown for non-workspace-ready trips */}
      {!isWorkspaceReady && (
        <Card className="p-8">
          <div className="max-w-lg mx-auto text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
              {trip.status === "generating" ? (
                <RefreshCw className="w-7 h-7 text-orange-500 animate-spin" />
              ) : trip.status === "intake" ? (
                <MessageSquare className="w-7 h-7 text-orange-500" />
              ) : (
                <Clock className="w-7 h-7 text-orange-500" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">{statusInfo?.label ?? trip.status}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{statusInfo?.desc}</p>
            </div>

            {/* Animated progress messages for generating state */}
            {trip.status === "generating" && <GeneratingProgressClient />}

            {/* Context from intake data */}
            {trip.intake_data?.where && (
              <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-4 text-sm text-left space-y-2">
                <p className="font-semibold text-zinc-700 mb-1">Detail Trip</p>
                {trip.intake_data.where && <p className="text-zinc-600">📍 <span className="font-medium">{trip.intake_data.where}</span></p>}
                {trip.intake_data.when && <p className="text-zinc-600">📅 <span className="font-medium">{trip.intake_data.when}</span></p>}
                {trip.intake_data.who && <p className="text-zinc-600">👥 <span className="font-medium">{trip.intake_data.who}</span></p>}
                {trip.intake_data.budget && <p className="text-zinc-600">💰 <span className="font-medium">{trip.intake_data.budget}</span></p>}
                {trip.intake_data.vibe && <p className="text-zinc-600">✨ <span className="font-medium">{trip.intake_data.vibe}</span></p>}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {trip.status === "intake" && (
                <Link
                  href={`/trip/new/intake?tripId=${trip.id}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-colors"
                >
                  Lanjutkan Perencanaan <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              {(trip.status === "generating" || trip.status === "draft") && (
                <RefreshButton />
              )}
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold text-sm hover:bg-zinc-50 transition-colors"
              >
                Kembali ke Dashboard
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Full workspace — only shown when itinerary is ready */}
      {isWorkspaceReady && (
        <>
          {/* Activate / Complete banners (owner only, when approved or active) */}
          {isOwner && (trip.status === "approved" || trip.status === "active") && (
            <TripActionBanner tripId={trip.id} tripStatus={trip.status} />
          )}

          {/* Completed trip — show review link */}
          {trip.status === "completed" && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold text-green-800 text-sm">Trip selesai! 🎉</p>
                <p className="text-green-700 text-xs mt-0.5">Bagikan pengalamanmu dan dapatkan 50 poin untuk tiap ulasan vendor.</p>
              </div>
              <Link
                href={`/trip/${trip.id}/review`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition-colors"
              >
                Tulis Ulasan
              </Link>
            </div>
          )}

          <div className="mt-1">
            <WeatherBanner
              city={destinationCity}
              fallbackAdvice="Ada potensi perubahan cuaca. Prioritaskan aktivitas outdoor di pagi hari jika memungkinkan."
            />
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/trip/${trip.id}/packing`}
                className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Buka Packing List
              </Link>
              <Link
                href={`/trip/${trip.id}/memory`}
                className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Buka Memory Wall
              </Link>
              {trip.status === "completed" ? (
                <Link
                  href={`/trip/${trip.id}/review`}
                  className="inline-flex rounded-full border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                >
                  Tulis Review Vendor
                </Link>
              ) : null}
              <a
                href={`/api/trip/${trip.id}/export-pdf`}
                className="inline-flex rounded-full border border-[var(--brand)]/35 bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-strong)] transition hover:opacity-85"
              >
                Download PDF Itinerary
              </a>
              <a
                href={`/trip/s/${trip.public_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full border border-[var(--brand-blue)]/35 bg-[var(--brand-blue-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-blue)] transition hover:opacity-85"
              >
                Lihat Halaman Share
              </a>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <Suspense fallback={<TimelineSkeleton />}>
                <TimelineSection
                  tripId={trip.id}
                  canRegen={isOwner && (trip.status === "approved" || trip.status === "active")}
                />
              </Suspense>

              <Suspense fallback={<PanelSkeleton />}>
                <MapSection tripId={trip.id} />
              </Suspense>
            </div>

            <div className="space-y-4">
              <EditorChat tripId={trip.id} />

              <TripLiveChat tripId={trip.id} />

              <Suspense fallback={<PanelSkeleton />}>
                <BudgetSection tripId={trip.id} totalBudget={totalBudget} />
              </Suspense>
            </div>
          </div>
        </>
      )}

       {/* Draft state — allow AI editor after generation */}
       {trip.status === "draft" && (
         <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
           <div className="space-y-4">
             <Suspense fallback={<TimelineSkeleton />}>
               <TimelineSection tripId={trip.id} />
             </Suspense>
             <Suspense fallback={<PanelSkeleton />}>
               <MapSection tripId={trip.id} />
             </Suspense>
           </div>
           <div className="space-y-4">
             <EditorChat tripId={trip.id} />
             <Suspense fallback={<PanelSkeleton />}>
               <BudgetSection tripId={trip.id} totalBudget={totalBudget} />
             </Suspense>
           </div>
         </div>
       )}
    </div>
  );
}
