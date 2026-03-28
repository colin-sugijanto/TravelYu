import { getCurrentAppUser } from "@/lib/auth";

type IntakeMode = "standard" | "surprise";

const REQUIRED_FIELDS_BY_MODE: Record<IntakeMode, readonly string[]> = {
  standard: ["who", "vibe", "when", "where", "budget", "pacing", "specialNeeds"],
  surprise: ["who", "when", "budget", "pacing", "specialNeeds"],
};

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  who: [
    /\b(saya|kami|aku|pasangan|suami|istri|keluarga|teman|rombongan|solo|sendiri|anak)\b/i,
    /\b\d+\s*orang\b/i,
  ],
  vibe: [
    /\b(vibe|suasana|mood|nuansa|gaya\s*trip)\b/i,
    /\b(santai|romantis|petualangan|adventure|culinary|kuliner|budaya|healing|relax)\b/i,
  ],
  when: [
    /\b(kapan|tanggal|tgl|hari|malam|minggu|bulan|juni|juli|agustus|september|oktober|november|desember|januari|februari|maret|april|mei)\b/i,
    /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/i,
  ],
  where: [
    /\b(where|tujuan|destinasi|ke\s+[a-z])\b/i,
    /\b(bali|lombok|yogyakarta|jogja|jakarta|bandung|surabaya|nusa penida|komodo|raja ampat|labuan bajo|manado|flores|bromo|gili)\b/i,
  ],
  budget: [/\b(budget|anggaran|biaya|rp\s?\d|juta|ribu|k|rb)\b/i],
  pacing: [/\b(pacing|ritme|tempo|pelan|santai|padat|packed|balanced|seimbang|itinerary)\b/i],
  specialNeeds: [
    /\b(special\s*needs?|kebutuhan\s*khusus|preferensi\s*khusus|aksesibilitas|disabilitas)\b/i,
    /\b(halal|lift|kursi\s*roda|alergi|vegetarian|vegan|ramah\s*anak|tidak\s*ada|ga\s*ada|gak\s*ada|none)\b/i,
  ],
};

function isFieldCompleted(field: string, content: string) {
  const patterns = FIELD_PATTERNS[field] ?? [];
  return patterns.some((pattern) => pattern.test(content));
}

function summarizeConversation(conversationHistory: string, requiredFields: readonly string[]) {
  const normalized = conversationHistory.replace(/\s+/g, " ").trim();
  const snippets: string[] = [];

  for (const field of requiredFields) {
    const patterns = FIELD_PATTERNS[field] ?? [];
    const sentence = normalized
      .split(/[.!?]/)
      .map((part) => part.trim())
      .find((part) => patterns.some((pattern) => pattern.test(part)));

    if (sentence) {
      snippets.push(`${field}: ${sentence.slice(0, 120)}`);
    }
  }

  return snippets.join(" | ").slice(0, 800);
}

/**
 * POST /api/trip/[id]/intake-check
 *
 * Server-side intake completion check (P7.4 dual detection).
 * Evaluates the conversation to determine if all 7 parameters have been collected.
 * Called from the client after each assistant message as a safety-net beside token detection.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await params; // ensure id is resolved

  const appUser = await getCurrentAppUser();
  if (!appUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { conversationHistory: string; mode?: IntakeMode };
  try {
    body = (await request.json()) as { conversationHistory: string; mode?: IntakeMode };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { conversationHistory, mode } = body;
  const resolvedMode: IntakeMode = mode === "surprise" ? "surprise" : "standard";
  const requiredFields = REQUIRED_FIELDS_BY_MODE[resolvedMode];

  if (typeof conversationHistory !== "string" || conversationHistory.length < 10) {
    return Response.json({ complete: false, missingParams: [...requiredFields], summary: "" });
  }

  const sampled = conversationHistory.slice(0, 5000);
  const missingParams = requiredFields.filter((field) => !isFieldCompleted(field, sampled));

  return Response.json({
    complete: missingParams.length === 0,
    missingParams,
    summary: summarizeConversation(sampled, requiredFields),
  });
}
