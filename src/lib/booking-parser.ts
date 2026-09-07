import type { BookingType, ParsedBooking } from "@/types/domain";

const BOOKING_REF_RE = /\b([A-Z0-9]{5,8})\b/;
const PROVIDERS = [
  "Garuda",
  "Lion",
  "AirAsia",
  "Citilink",
  "Batik",
  "Super Air Jet",
  "Sriwijaya",
  "KAI",
  "Traveloka",
  "Tiket.com",
  "Agoda",
  "Airbnb",
  "Booking.com",
  "Trivago",
];

const CITY_RE = /\b(CGK|DPS|SUB|JOG|YIA|BDO|BPN|LOP|SRG|BTH|PLM|MES|KNO|UPG|MDC|AMQ|DJJ|LBJ|GTO)\b/i;

/**
 * Deterministic fallback parser (no LLM). Extracts provider, PNR-ish code,
 * origin→destination airport codes, and ISO-ish dates. Used when OpenRouter
 * is unconfigured or as a pre-fill before AI refinement.
 */
export function fallbackParseBooking(raw: string): ParsedBooking {
  const text = raw.trim();
  const upper = text.toUpperCase();

  let booking_type: BookingType = "other";
  if (/FLIGHT|PENERBANGAN|BOARDING|CGK|DPS|QZ|GA-|JT-|ID-|QG-|IU-/i.test(text)) booking_type = "flight";
  else if (/KAI|KERETA|TRAIN|STASIUN/i.test(text)) booking_type = "train";
  else if (/HOTEL|CHECK-?IN|VILLA|RESORT|AGODA|AIRBNB/i.test(text)) booking_type = "hotel";
  else if (/FERRY|KAPAL|FAST BOAT|PELNI/i.test(text)) booking_type = "ferry";
  else if (/BUS|TRAVEL|SHUTTLE/i.test(text)) booking_type = "bus";

  const provider = PROVIDERS.find((p) => upper.includes(p.toUpperCase())) ?? null;

  const refMatch =
    /(?:PNR|BOOKING(?: REF| CODE)?|KODE(?: BOOKING| PEMESANAN)?)\s*[:#]?\s*([A-Z0-9]{5,8})/i.exec(text) ??
    BOOKING_REF_RE.exec(upper);
  const booking_ref = refMatch?.[1]?.toUpperCase() ?? null;

  const routeMatch = /([A-Z]{3})\s*(?:→|->|TO|KE)\s*([A-Z]{3})/i.exec(text);
  const cityMatches = [...text.matchAll(new RegExp(CITY_RE, "gi"))].map((m) => m[1].toUpperCase());
  const origin = routeMatch?.[1]?.toUpperCase() ?? cityMatches[0] ?? null;
  const destination = routeMatch?.[2]?.toUpperCase() ?? cityMatches[1] ?? null;

  const dateMatch = /(\d{4}-\d{2}-\d{2})|(\d{1,2}[\s/-](?:Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)[a-z]*[\s/-]\d{2,4})/i.exec(text);

  const titleBits = [provider, booking_type !== "other" ? booking_type : null, origin && destination ? `${origin} → ${destination}` : null].filter(
    Boolean,
  );

  return {
    booking_type,
    provider,
    booking_ref,
    title: titleBits.length > 0 ? titleBits.join(" · ") : text.slice(0, 80) || "Booking",
    origin,
    destination,
    depart_at: null,
    arrive_at: null,
    check_in: null,
    check_out: null,
    details: {
      rawExcerpt: text.slice(0, 500),
      dateHint: dateMatch?.[0] ?? null,
    },
    confidence: booking_ref || provider ? "medium" : "low",
  };
}

export const PARSE_BOOKING_SYSTEM_PROMPT = `Kamu adalah TravelYu Booking Parser. Ekstrak detail booking perjalanan Indonesia dari teks tiket/voucher (flight Garuda/Lion/AirAsia/Citilink, KAI, hotel Agoda/Tiket/Airbnb, ferry/bus).
Return JSON ONLY (no markdown):
{"booking_type":"flight|train|hotel|ferry|bus|activity|other","provider":"...","booking_ref":"PNR/kode booking","title":"...","origin":"CGK","destination":"DPS","depart_at":"ISO datetime or null","arrive_at":"ISO datetime or null","check_in":"YYYY-MM-DD or null","check_out":"YYYY-MM-DD or null","details":{},"confidence":"high|medium|low"}
Gunakan null bila tidak yakin. Judul ringkas Bahasa Indonesia.`;
