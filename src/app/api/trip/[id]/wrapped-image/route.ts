import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findTripByIdentifier, isTripMember } from "@/lib/trip-access";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatShortIdr(value: number) {
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (value >= 1000) return `Rp${Math.round(value / 1000)}rb`;
  return `Rp${value}`;
}

/**
 * GET /api/trip/[id]/wrapped-image — shareable SVG card for IG Story / WA Status.
 * Query: ?format=svg (default) — returns image/svg+xml, downloadable.
 * Uses same stats as /wrapped JSON, no extra credits.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await findTripByIdentifier<{
    id: string;
    user_id: string;
    public_id: string;
    status: string;
    total_est_cost_idr: number | null;
    intake_data: Record<string, unknown> | null;
  }>(id, "id,user_id,public_id,status,total_est_cost_idr,intake_data");

  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  if (trip.user_id !== appUser.id && !isAdminRole(appUser.role)) {
    const member = await isTripMember(trip.id, appUser.id);
    if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [itemsRes, photosRes] = await Promise.all([
    supabaseAdmin.from("itinerary_items").select("day_number,est_cost_idr,actual_cost_idr").eq("trip_id", trip.id),
    supabaseAdmin.from("trip_photos").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
  ]);

  const items = (itemsRes.data as Array<{ day_number: number; est_cost_idr: number; actual_cost_idr: number | null }> | null) ?? [];
  const days = items.length > 0 ? Math.max(...items.map((i) => i.day_number)) : 0;
  const spots = items.length;
  const photos = photosRes.count ?? 0;
  const estTotal = items.reduce((s, i) => s + (i.est_cost_idr ?? 0), 0) || trip.total_est_cost_idr || 0;
  const actualRows = items.filter((i) => i.actual_cost_idr !== null && i.actual_cost_idr !== undefined);
  const actualTotal = actualRows.reduce((s, i) => s + (i.actual_cost_idr ?? 0), 0);
  const savings = actualRows.length > 0 ? estTotal - actualTotal : null;

  const where = esc(String((trip.intake_data as Record<string, unknown> | null)?.where ?? "Indonesia").slice(0, 40));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f97316"/>
      <stop offset="0.55" stop-color="#f43f5e"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" rx="48" fill="url(#bg)"/>
  <rect x="48" y="48" width="984" height="1254" rx="32" fill="rgba(255,255,255,0.12)"/>
  <text x="90" y="160" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="bold" fill="#ffffff" letter-spacing="6">TRAVELYU WRAPPED</text>
  <text x="90" y="300" font-family="Arial,Helvetica,sans-serif" font-size="92" font-weight="900" fill="#ffffff">${days} Hari di</text>
  <text x="90" y="400" font-family="Arial,Helvetica,sans-serif" font-size="92" font-weight="900" fill="#ffffff">${where}</text>
  <text x="90" y="470" font-family="Arial,Helvetica,sans-serif" font-size="36" fill="#ffe4c7">${spots} spot  &#8226;  ${photos} foto  &#8226;  ${esc(formatShortIdr(estTotal))}</text>
  <g font-family="Arial,Helvetica,sans-serif">
    <rect x="90" y="540" width="290" height="200" rx="24" fill="rgba(255,255,255,0.2)"/>
    <text x="235" y="620" text-anchor="middle" font-size="72" font-weight="900" fill="#fff">${days}</text>
    <text x="235" y="665" text-anchor="middle" font-size="32" fill="#fff">Hari</text>
    <rect x="395" y="540" width="290" height="200" rx="24" fill="rgba(255,255,255,0.2)"/>
    <text x="540" y="620" text-anchor="middle" font-size="72" font-weight="900" fill="#fff">${spots}</text>
    <text x="540" y="665" text-anchor="middle" font-size="32" fill="#fff">Spot</text>
    <rect x="700" y="540" width="290" height="200" rx="24" fill="rgba(255,255,255,0.2)"/>
    <text x="845" y="620" text-anchor="middle" font-size="72" font-weight="900" fill="#fff">${photos}</text>
    <text x="845" y="665" text-anchor="middle" font-size="32" fill="#fff">Foto</text>
  </g>
  <text x="90" y="820" font-family="Arial,Helvetica,sans-serif" font-size="40" fill="#ffffff">Estimasi ${esc(formatShortIdr(estTotal))}${actualRows.length > 0 ? `  &#8226;  Aktual ${esc(formatShortIdr(actualTotal))}` : ""}</text>
  ${savings !== null && savings >= 0 ? `<text x="90" y="880" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="bold" fill="#fef08a">Hemat ${esc(formatShortIdr(savings))}</text>` : ""}
  <text x="90" y="1180" font-family="Arial,Helvetica,sans-serif" font-size="32" fill="#ffffff">Planned &amp; Preserved with TravelYu</text>
  <text x="90" y="1230" font-family="Arial,Helvetica,sans-serif" font-size="28" fill="#ffe4c7">travelyu.vercel.app/trip/s/${esc(trip.public_id)}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename="travelyu-wrapped-${trip.public_id}.svg"`,
    },
  });
}
