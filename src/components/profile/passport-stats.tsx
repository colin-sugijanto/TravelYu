import { Card, CardTitle } from "@/components/ui/card";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface PassportStatsProps {
  userId: string;
}

/**
 * "Digital Passport" — compounding history across all trips.
 * Server component: total trips/days, provinces from vendors, photos, spend.
 */
export async function PassportStats({ userId }: PassportStatsProps) {
  let stats = { trips: 0, days: 0, provinces: 0 as number | string, photos: 0, spend: 0 };

  try {
    const [tripsRes, photosRes] = await Promise.all([
      supabaseAdmin.from("trips").select("id,trip_start_date,trip_end_date,total_est_cost_idr").eq("user_id", userId).limit(100),
      supabaseAdmin.from("trip_photos").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    const trips = (tripsRes.data as Array<{ trip_start_date: string | null; trip_end_date: string | null; total_est_cost_idr: number | null }> | null) ?? [];
    let days = 0;
    let spend = 0;
    for (const t of trips) {
      spend += t.total_est_cost_idr ?? 0;
      if (t.trip_start_date && t.trip_end_date) {
        const diff = Math.round(
          (new Date(t.trip_end_date).getTime() - new Date(t.trip_start_date).getTime()) / 86_400_000,
        );
        if (Number.isFinite(diff) && diff >= 0) days += diff + 1;
      }
    }

    let provinces: number | string = "—";
    try {
      const { data: items } = await supabaseAdmin
        .from("itinerary_items")
        .select("trip_id,vendor_id,vendors!inner(province)")
        .in("trip_id", trips.length > 0 ? (await supabaseAdmin.from("trips").select("id").eq("user_id", userId).limit(100)).data?.map((r: { id: string }) => r.id) ?? [] : []);
      const set = new Set<string>();
      for (const row of (items as Array<{ vendors: { province: string } | { province: string }[] }> | null) ?? []) {
        const v = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
        if (v?.province) set.add(v.province);
      }
      if (set.size > 0) provinces = set.size;
    } catch {
      provinces = "—";
    }

    stats = { trips: trips.length, days, provinces, photos: photosRes.count ?? 0, spend };
  } catch {
    // keep defaults
  }

  const tiles = [
    { label: "Trip", value: String(stats.trips) },
    { label: "Hari di Jalan", value: String(stats.days) },
    { label: "Provinsi", value: String(stats.provinces) },
    { label: "Foto", value: String(stats.photos) },
  ];

  return (
    <Card className="p-5">
      <CardTitle>🛂 Digital Passport</CardTitle>
      <p className="mt-1 text-xs text-zinc-500">Jejak permanen semua perjalananmu di TravelYu.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-extrabold">{t.value}</p>
            <p className="text-[11px] text-zinc-500">{t.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
