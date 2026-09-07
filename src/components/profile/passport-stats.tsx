import { Card, CardTitle } from "@/components/ui/card";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface PassportStatsProps {
  userId: string;
}

const PROVINCE_HINTS = [
  "Bali", "Jakarta", "Jawa Barat", "Jawa Tengah", "Jawa Timur", "Yogyakarta",
  "Banten", "Sumatera Utara", "Sumatera Barat", "Riau", "Lampung", "Kalimantan",
  "Sulawesi", "Lombok", "Nusa Tenggara", "Labuan Bajo", "Papua", "Maluku", "Aceh",
];

/**
 * "Digital Passport" — compounding history across all trips.
 * Server component: total trips/days, provinces, photos, spend + visual trail.
 * Mobile: 2-col grid. Desktop: 4-col + province chips.
 */
export async function PassportStats({ userId }: PassportStatsProps) {
  let stats = { trips: 0, days: 0, provinces: [] as string[], photos: 0, spend: 0 };

  try {
    const [tripsRes, photosRes] = await Promise.all([
      supabaseAdmin.from("trips").select("id,trip_start_date,trip_end_date,total_est_cost_idr,intake_data").eq("user_id", userId).limit(100),
      supabaseAdmin.from("trip_photos").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    const trips = (tripsRes.data as Array<{ trip_start_date: string | null; trip_end_date: string | null; total_est_cost_idr: number | null; intake_data: Record<string, unknown> | null }> | null) ?? [];
    let days = 0;
    let spend = 0;
    const provinceSet = new Set<string>();
    for (const t of trips) {
      spend += t.total_est_cost_idr ?? 0;
      if (t.trip_start_date && t.trip_end_date) {
        const diff = Math.round(
          (new Date(t.trip_end_date).getTime() - new Date(t.trip_start_date).getTime()) / 86_400_000,
        );
        if (Number.isFinite(diff) && diff >= 0) days += diff + 1;
      }
      const where = String((t.intake_data as Record<string, unknown> | null)?.where ?? "");
      for (const hint of PROVINCE_HINTS) {
        if (where.toLowerCase().includes(hint.toLowerCase())) provinceSet.add(hint);
      }
    }

    try {
      const tripIds = (tripsRes.data as Array<{ id: string }> | null)?.map((r) => r.id) ?? [];
      if (tripIds.length > 0) {
        const { data: items } = await supabaseAdmin
          .from("itinerary_items")
          .select("trip_id,vendors!inner(province)")
          .in("trip_id", tripIds.slice(0, 100))
          .limit(500);
        for (const row of (items as Array<{ vendors: { province: string } | Array<{ province: string }> }> | null) ?? []) {
          const v = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
          if (v?.province) provinceSet.add(v.province);
        }
      }
    } catch {
      // vendor province optional
    }

    stats = { trips: trips.length, days, provinces: [...provinceSet].slice(0, 20), photos: photosRes.count ?? 0, spend };
  } catch {
    // keep defaults
  }

  const tiles = [
    { label: "Trip", value: String(stats.trips), icon: "🧳" },
    { label: "Hari di Jalan", value: String(stats.days), icon: "📅" },
    { label: "Daerah Dijelajah", value: String(stats.provinces.length || "—"), icon: "🗺️" },
    { label: "Foto", value: String(stats.photos), icon: "📷" },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 p-5 text-white">
        <CardTitle className="text-white">🛂 Digital Passport</CardTitle>
        <p className="mt-1 text-xs opacity-80">Jejak permanen semua perjalananmu di TravelYu.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-white/15 px-3 py-2.5 text-center backdrop-blur">
              <p className="text-sm">{t.icon}</p>
              <p className="text-lg font-extrabold">{t.value}</p>
              <p className="text-[11px] opacity-80">{t.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="p-5">
        {stats.provinces.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {stats.provinces.map((p) => (
              <span key={p} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                📍 {p}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Selesaikan trip pertamamu untuk membuka stempel passport perdana ✈️</p>
        )}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all"
            style={{ width: `${Math.min(100, (stats.provinces.length / 10) * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">Level berikutnya: 10 daerah unik untuk lencana Nusantara Explorer 🏝️</p>
      </div>
    </Card>
  );
}
