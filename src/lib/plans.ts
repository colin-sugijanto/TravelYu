import type { PlanTier } from "@/types/domain";

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  tagline: string;
  priceMonthlyIdr: number;
  priceYearlyIdr: number;
  monthlyCredits: number;
  maxActiveTrips: number;
  maxPhotosPerTrip: number;
  maxBookingsPerTrip: number;
  maxGroupMembers: number;
  rolloverPercent: number;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

/**
 * Single source of truth for plan structure (mirrors subscription_plans seed).
 * Prices in IDR. Free = Rp 0.
 */
export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    name: "Free",
    tagline: "Coba TravelYu untuk 1 trip pertama",
    priceMonthlyIdr: 0,
    priceYearlyIdr: 0,
    monthlyCredits: 30,
    maxActiveTrips: 2,
    maxPhotosPerTrip: 10,
    maxBookingsPerTrip: 3,
    maxGroupMembers: 2,
    rolloverPercent: 0,
    features: [
      "30 AI credits / bulan (~1 itinerary lengkap)",
      "Hingga 2 trip aktif",
      "Ticket locker: 3 booking / trip",
      "Memory wall: 10 foto / trip",
      "Link share publik dengan branding TravelYu",
      "Today Mode dasar",
    ],
    cta: "Mulai Gratis",
  },
  member: {
    tier: "member",
    name: "Member",
    tagline: "Untuk traveler rutin & keluarga kecil",
    priceMonthlyIdr: 49000,
    priceYearlyIdr: 390000,
    monthlyCredits: 400,
    maxActiveTrips: 20,
    maxPhotosPerTrip: 100,
    maxBookingsPerTrip: 50,
    maxGroupMembers: 6,
    rolloverPercent: 0,
    features: [
      "400 AI credits / bulan (~10 itinerary + edit)",
      "Hingga 20 trip aktif",
      "Ticket locker tanpa batas praktis",
      "Today Mode + expense actual-vs-estimasi",
      "Memory scrapbook + Wrapped card tanpa watermark",
      "Export PDF bersih + prioritas antrean AI",
      "Group trip hingga 6 orang",
    ],
    cta: "Pilih Member",
    highlighted: true,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "Untuk keluarga besar, kreator & power traveler",
    priceMonthlyIdr: 99000,
    priceYearlyIdr: 790000,
    monthlyCredits: 1200,
    maxActiveTrips: 100,
    maxPhotosPerTrip: 500,
    maxBookingsPerTrip: 200,
    maxGroupMembers: 15,
    rolloverPercent: 20,
    features: [
      "1200 AI credits / bulan + rollover 20%",
      "Hingga 100 trip aktif",
      "Shared family vault (15 anggota)",
      "Semua fitur Member",
      "Digital Passport + halaman kreator",
      "CS prioritas + bantuan refund/reschedule",
      "Akses awal fitur baru",
    ],
    cta: "Pilih Pro",
  },
};

export const PLAN_ORDER: PlanTier[] = ["free", "member", "pro"];

/** AI credit cost per endpoint — keep in sync with docs/pricing. */
export const AI_CREDIT_COSTS: Record<string, number> = {
  intake: 1,
  "compare-options": 6,
  "generate-trip": 25,
  editor: 2,
  "regen-day": 5,
  "parse-booking": 3,
  "packing-list": 2,
};

export function getPlanConfig(tier: PlanTier | string | null | undefined): PlanConfig {
  if (tier === "member" || tier === "pro" || tier === "free") return PLAN_CONFIGS[tier];
  return PLAN_CONFIGS.free;
}

export function formatPlanPrice(idr: number) {
  if (idr <= 0) return "Gratis";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(idr);
}
