import { generateText } from "ai";

import { model } from "@/lib/ai/openrouter";
import { getRateLimiter } from "@/lib/rate-limit";

const INTAKE_SYSTEM_PROMPT = `
Kamu adalah TravelYu AI Intake Agent untuk perencanaan perjalanan Indonesia.
Tugasmu: kumpulkan 7 parameter wajib melalui percakapan natural Bahasa Indonesia.
Parameter: who, vibe, when, where, budget, pacing, specialNeeds.

Aturan:
- Tanyakan satu hal per giliran.
- Jika user tidak tahu destinasi, aktifkan mode surprise dan bantu pilih.
- Jika budget tidak realistis, jelaskan gap dan tawarkan opsi.
- Setelah 7 parameter terkumpul, rangkum singkat dan minta konfirmasi user.
- Gaya bahasa: hangat, ringkas, tidak menghakimi.
`;

export async function POST(request: Request) {
  const limiter = getRateLimiter();
  if (limiter) {
    const key = request.headers.get("x-forwarded-for") ?? "anonymous";
    const result = await limiter.limit(`ai_intake:${key}`);
    if (!result.success) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  const { messages } = (await request.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const conversation = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const result = await generateText({
    model,
    system: INTAKE_SYSTEM_PROMPT,
    prompt: `Percakapan sejauh ini:\n${conversation}\n\nBalas sebagai intake agent untuk pertanyaan berikutnya atau ringkasan jika 7 parameter sudah lengkap.`,
  });

  return Response.json({ text: result.text });
}
