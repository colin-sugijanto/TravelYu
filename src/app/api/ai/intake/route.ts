import { streamText } from "ai";

import { getCurrentAppUser } from "@/lib/auth";
import { toModelMessages } from "@/lib/ai/messages";
import { model } from "@/lib/ai/openrouter";
import { checkAiRateLimit } from "@/lib/rate-limit";

const INTAKE_SYSTEM_PROMPT = `
Kamu adalah TravelYu AI Intake Agent untuk perencanaan perjalanan Indonesia.
Tugasmu: kumpulkan 7 parameter wajib melalui percakapan natural Bahasa Indonesia.
Parameter: who, vibe, when, where, budget, pacing, specialNeeds.

Aturan:
- Tanyakan satu hal per giliran.
- Jika user tidak tahu destinasi, aktifkan mode surprise dan bantu pilih.
- Jika budget tidak realistis, jelaskan gap dan tawarkan opsi.
- Setelah 7 parameter terkumpul, rangkum singkat dan minta konfirmasi user.
- Setelah user mengonfirmasi ringkasan final, akhiri jawaban dengan token persis [INTAKE_COMPLETE] di baris terakhir.
- Jangan keluarkan token [INTAKE_COMPLETE] sebelum semua parameter wajib benar-benar lengkap.
- Gaya bahasa: hangat, ringkas, tidak menghakimi.
`;

const SURPRISE_MODE_APPENDIX = `
Mode Surprise Me AKTIF:
- Jangan minta user menentukan destinasi spesifik di awal.
- Wajib kumpulkan minimal: who, when, budget, pacing, specialNeeds.
- Setelah minimal parameter terkumpul, usulkan 2-3 kandidat destinasi Indonesia yang realistis sesuai musim, cuaca, dan budget user.
- Konfirmasi 1 kandidat terbaik, lalu lanjutkan intake sampai siap comparison.
`;

const STANDARD_MODE_APPENDIX = `
Mode Standard AKTIF:
- Pastikan preferensi destinasi (where) tergali jelas sejak awal.
- Jika user belum tahu destinasi, boleh tawarkan pindah ke surprise mode.
`;

export async function POST(request: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await checkAiRateLimit(appUser.id, "intake");
  if (blocked) {
    return blocked;
  }

  const { messages, mode } = (await request.json()) as {
    messages: unknown;
    mode?: "standard" | "surprise";
  };

  const modelMessages = await toModelMessages(messages);

  const result = streamText({
    model,
    maxRetries: 2,
    system: `${INTAKE_SYSTEM_PROMPT}
Mode trip saat ini: ${mode === "surprise" ? "Surprise Me" : "Standard"}.
${mode === "surprise" ? SURPRISE_MODE_APPENDIX : STANDARD_MODE_APPENDIX}`,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
