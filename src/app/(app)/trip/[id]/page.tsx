import { Suspense } from "react";
import Link from "next/link";

import { BudgetTracker } from "@/components/itinerary/budget-tracker";
import { EditorChat } from "@/components/itinerary/editor-chat";
import { ItineraryMap } from "@/components/itinerary/map";
import { ItineraryTimeline } from "@/components/itinerary/timeline";
import { Card, CardTitle, CardText } from "@/components/ui/card";
import { WeatherBanner } from "@/components/weather/weather-banner";
import { getCurrentAppUser } from "@/lib/auth";
import { getItineraryItems, getTripById } from "@/lib/data";
import { formatTripName } from "@/lib/utils";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, MapPin, MessageSquare, RefreshCw } from "lucide-react";
import { RefreshButton } from "@/components/trip/refresh-button";
import { GeneratingPoller } from "@/components/trip/generating-poller";

async function TimelineSection({ tripId }: { tripId: string }) {
  const items = await getItineraryItems(tripId);
  return <ItineraryTimeline items={items} />;
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
    desc: "Itinerary sudah dibuat dan menunggu review dari tim TravelYu.",
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  approved: {
    label: "Disetujui",
    desc: "Itinerary sudah disetujui! Kamu bisa langsung cek detail perjalananmu.",
    color: "bg-green-50 border-green-200 text-green-800",
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
  const isPendingStatus = !isWorkspaceReady && trip.status !== "draft";
  const statusInfo = STATUS_INFO[trip.status];

  // Destination for weather (extract first word of where field)
  const destinationCity = trip.intake_data?.where?.split(/[,\s]/)[0] ?? "Bali";
  const totalBudget = trip.total_est_cost_idr ?? 15000000;

  return (
    <div className="space-y-4">
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
              {trip.status === "generating" && <GeneratingPoller />}
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
          <div className="mt-1">
            <WeatherBanner
              city={destinationCity}
              condition="rain"
              advice="Ada potensi hujan sore 70% di day 2-3. Disarankan pindahkan outdoor attraction ke pagi hari."
            />
          </div>

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
              <EditorChat tripId={trip.id} userId={appUser.id} />

              <Suspense fallback={<PanelSkeleton />}>
                <BudgetSection tripId={trip.id} totalBudget={totalBudget} />
              </Suspense>
            </div>
          </div>
        </>
      )}

      {/* Draft state — show itinerary in read-only mode */}
      {trip.status === "draft" && (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] opacity-75">
          <Suspense fallback={<TimelineSkeleton />}>
            <TimelineSection tripId={trip.id} />
          </Suspense>
          <Suspense fallback={<PanelSkeleton />}>
            <BudgetSection tripId={trip.id} totalBudget={totalBudget} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
