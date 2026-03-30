"use client";

import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { INTAKE_FIELDS } from "@/lib/constants";
import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DefaultChatTransport, type UIMessage } from "ai";

const INTAKE_COMPLETE_TOKEN = "[INTAKE_COMPLETE]";

type IntakeProgressPayload = {
  who?: string;
  vibe?: string;
  when?: string;
  where?: string;
  budget?: string;
  pacing?: string;
  specialNeeds?: string;
};

const DESTINATION_KEYWORDS = [
  "bali",
  "lombok",
  "yogyakarta",
  "jogja",
  "jakarta",
  "bandung",
  "surabaya",
  "nusa penida",
  "komodo",
  "raja ampat",
  "labuan bajo",
  "manado",
  "flores",
  "bromo",
  "gili",
];

const VIBE_KEYWORDS = [
  "healing",
  "adventure",
  "petualangan",
  "kuliner",
  "budaya",
  "santai",
  "romantic",
  "romantis",
  "family",
  "keluarga",
];

function extractIntakeParams(text: string): IntakeProgressPayload {
  const normalized = text.toLowerCase();
  const payload: IntakeProgressPayload = {};

  const whoMatch = normalized.match(
    /(?:kami|saya|aku|ada)\s+(\d+)\s+orang|\b(pasangan|keluarga|sendiri|solo|teman)\b/i,
  );
  if (whoMatch) payload.who = whoMatch[0];

  const detectedVibes = VIBE_KEYWORDS.filter((keyword) => normalized.includes(keyword));
  if (detectedVibes.length > 0) payload.vibe = detectedVibes.join(", ");

  const destination = DESTINATION_KEYWORDS.find((keyword) => normalized.includes(keyword));
  if (destination) payload.where = destination;

  const whenMatch = normalized.match(
    /(\d{1,2}\s*[-–]\s*\d{1,2}\s+\w+|\w+\s+\d{4}|\d+\s*hari\s*\d*\s*malam|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i,
  );
  if (whenMatch) payload.when = whenMatch[0];

  const budgetMatch = normalized.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(?:juta|ribu|k|rb)/i);
  if (budgetMatch) payload.budget = budgetMatch[0];

  if (/\b(santai|pelan|slow)\b/i.test(normalized)) payload.pacing = "slow";
  else if (/\b(padat|packed|banyak)\b/i.test(normalized)) payload.pacing = "packed";
  else if (/\b(balanced|seimbang)\b/i.test(normalized)) payload.pacing = "balanced";

  if (/\b(vegetarian|vegan|halal|alergi|aksesibilitas|kursi roda|disabilitas|lansia|anak kecil)\b/i.test(normalized)) {
    payload.specialNeeds = "ada";
  } else if (/\b(tidak ada|ga ada|gak ada|none)\b/i.test(normalized)) {
    payload.specialNeeds = "tidak ada";
  }

  return payload;
}

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
    /\b(bali|lombok|yogyakarta|jogja|jakarta|bandung|surabaya|nusa penida|komodo|raja ampat|labuan bajo)\b/i,
  ],
  budget: [
    /\b(budget|anggaran|biaya|rp\s?\d|juta|ribu)\b/i,
  ],
  pacing: [
    /\b(pacing|ritme|tempo|pelan|santai|padat|2-3 aktivitas|itinerary)\b/i,
  ],
  specialNeeds: [
    /\b(special\s*needs?|kebutuhan\s*khusus|preferensi\s*khusus|aksesibilitas|disabilitas)\b/i,
    /\b(halal|lift|kursi\s*roda|alergi|vegetarian|vegan|ramah\s*anak)\b/i,
  ],
};

function hasAssistantCompletionSignal(messageTexts: Array<{ role: "assistant" | "user"; text: string }>) {
  return messageTexts.some((message) => {
    if (message.role !== "assistant") return false;

    const text = message.text;
    if (text.includes(INTAKE_COMPLETE_TOKEN)) return true;

    const normalized = stripControlTokens(text).toLowerCase();
    return (
      /intake\s+selesai/.test(normalized) ||
      /semua\s+parameter\s+sudah\s+lengkap/.test(normalized) ||
      /lanjut(kan)?\s+ke\s+opsi\s+(trip\s+)?(comparison|perbandingan)/.test(normalized) ||
      /opsi\s+(trip\s+)?(comparison|perbandingan)/.test(normalized) ||
      /bersiap\s+untuk\s+memberikan\s+opsi/.test(normalized)
    );
  });
}

function isFieldCompleted(field: string, content: string) {
  const patterns = FIELD_PATTERNS[field] ?? [];
  return patterns.some((pattern) => pattern.test(content));
}

function extractTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function stripControlTokens(text: string) {
  return text.replaceAll(INTAKE_COMPLETE_TOKEN, "").trim();
}

function toDisplayText(text: string) {
  let formatted = stripControlTokens(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\r\n/g, "\n")
    .trim();

  const inlineBulletCount = (formatted.match(/\s-\s(?=[A-Za-z0-9(])/g) ?? []).length;
  if (!formatted.includes("\n- ") && inlineBulletCount >= 2) {
    formatted = formatted.replace(/\s-\s(?=[A-Za-z0-9(])/g, "\n- ");
  }

  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted.trim();
}

function normalizeMessages(
  messages: Array<{
    id: string;
    role: "assistant" | "user" | "system";
    parts: Array<{ type: string; text?: string }>;
  }>,
) {
  return messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .map((message) => ({
      ...message,
      role: message.role as "assistant" | "user",
      parts: message.parts,
    }));
}

interface IntakeChatProps {
  tripId: string;
  mode: "standard" | "surprise";
}

const FIELD_LABELS: Record<string, string> = {
  who: "Siapa",
  vibe: "Suasana",
  when: "Kapan",
  where: "Tujuan",
  budget: "Anggaran",
  pacing: "Ritme",
  specialNeeds: "Kebutuhan Khusus",
};

const REQUIRED_FIELDS_BY_MODE: Record<"standard" | "surprise", readonly string[]> = {
  standard: INTAKE_FIELDS,
  surprise: ["who", "when", "budget", "pacing", "specialNeeds"],
};

export function IntakeChat({ tripId, mode }: IntakeChatProps) {
  const router = useRouter();
  const requiredFields = REQUIRED_FIELDS_BY_MODE[mode];
  const [input, setInput] = useState("");
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [serverIntakeComplete, setServerIntakeComplete] = useState(false);
  const autoAdvanceTriggeredRef = useRef(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trip/${encodeURIComponent(tripId)}/chat-history?type=intake`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: UIMessage[] };
        if (!cancelled && Array.isArray(data.messages) && data.messages.length > 0) {
          setInitialMessages(data.messages as UIMessage[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChatLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const saveMessages = useCallback(
    async (msgs: UIMessage[]) => {
      try {
        await fetch(`/api/trip/${encodeURIComponent(tripId)}/chat-history`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "intake",
            messages: msgs.map((m) => ({ id: m.id, role: m.role, parts: m.parts })),
          }),
        });
      } catch {
        // non-blocking
      }
    },
    [tripId],
  );

  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/ai/intake",
      body: {
        tripId,
        mode,
      },
    }),
    onFinish: ({ messages: msgs }) => {
      void saveMessages(msgs);
    },
  });

  const normalizedMessages = normalizeMessages(
    messages as Array<{
      id: string;
      role: "assistant" | "user" | "system";
      parts: Array<{ type: string; text?: string }>;
    }>,
  );

  const isLoading = status === "submitted" || status === "streaming";

  const messageTexts = useMemo(
    () =>
      normalizedMessages.map((message) => ({
        role: message.role,
        text: extractTextFromParts(message.parts),
      })),
    [normalizedMessages],
  );

  const tokenDetectedComplete = useMemo(() => hasAssistantCompletionSignal(messageTexts), [messageTexts]);

  const isIntakeCompleted = tokenDetectedComplete || serverIntakeComplete;

  const flattenedText = useMemo(() => messageTexts.map((message) => stripControlTokens(message.text)).join("\n"), [messageTexts]);

  const userOnlyConversationText = useMemo(
    () =>
      messageTexts
        .filter((message) => message.role === "user")
        .map((message) => stripControlTokens(message.text).trim())
        .filter(Boolean)
        .join("\n"),
    [messageTexts],
  );

  const intakeProgressPayload = useMemo(
    () => extractIntakeParams(userOnlyConversationText),
    [userOnlyConversationText],
  );

  const intakeSummaryForCompare = useMemo(() => {
    const userOnly = messageTexts
      .filter((message) => message.role === "user")
      .map((message) => stripControlTokens(message.text).trim())
      .filter(Boolean)
      .join("\n");

    const source = userOnly.length > 0 ? userOnly : flattenedText;
    return source.slice(0, 5000);
  }, [flattenedText, messageTexts]);

  const completed = useMemo(() => {
    return requiredFields.filter((field) => isFieldCompleted(field, userOnlyConversationText)).length;
  }, [requiredFields, userOnlyConversationText]);

  const progress = Math.round((completed / requiredFields.length) * 100);

  const send = async () => {
    if (!input.trim() || isLoading) return;

    const text = input;
    setInput("");
    await sendMessage({ text });
  };

  const generateOptions = useCallback(async () => {
    if (isGeneratingOptions || !intakeSummaryForCompare.trim()) return;

    setIsGeneratingOptions(true);
    setCompareError(null);

    try {
      const response = await fetch("/api/ai/compare-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          intakeSummary: intakeSummaryForCompare,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setCompareError(payload?.error ?? "Gagal membuat opsi comparison. Coba kirim 1 pesan konfirmasi lagi.");
        return;
      }

      router.push(`/trip/new/compare?tripId=${encodeURIComponent(tripId)}`);
    } finally {
      setIsGeneratingOptions(false);
    }
  }, [intakeSummaryForCompare, isGeneratingOptions, router, tripId]);

  useEffect(() => {
    if (serverIntakeComplete) return;
    if (!userOnlyConversationText.trim()) return;

    const payload = intakeProgressPayload;
    if (Object.keys(payload).length === 0) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetch(`/api/trip/${encodeURIComponent(tripId)}/intake-progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).catch(() => {
        // non-blocking; intake must continue even if background save fails
      });
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [intakeProgressPayload, serverIntakeComplete, tripId, userOnlyConversationText]);

  useEffect(() => {
    if (tokenDetectedComplete) {
      setServerIntakeComplete(true);
      return;
    }

    if (isLoading) return;
    if (messageTexts.length < 2) return;

    const last = messageTexts[messageTexts.length - 1];
    if (!last || last.role !== "assistant") return;

    const conversationHistory = userOnlyConversationText.slice(0, 5000);

    if (!conversationHistory.trim()) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetch(`/api/trip/${encodeURIComponent(tripId)}/intake-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationHistory, mode }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) return;
          const data = (await response.json()) as { complete?: boolean };
          if (data.complete) {
            setServerIntakeComplete(true);
          }
        })
        .catch(() => {
          // non-blocking fallback check
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, messageTexts, mode, tokenDetectedComplete, tripId, userOnlyConversationText]);

  useEffect(() => {
    if (isLoading) return;
    if (!isIntakeCompleted || autoAdvanceTriggeredRef.current) return;
    autoAdvanceTriggeredRef.current = true;
    void generateOptions();
  }, [generateOptions, isIntakeCompleted, isLoading]);

  if (!chatLoaded) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-5 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)]">
          <CardTitle>AI Intake Agent</CardTitle>
          <div className="mt-4 h-[380px] flex items-center justify-center">
            <p className="text-sm text-[var(--text-soft)]">Memuat riwayat chat...</p>
          </div>
        </Card>
        <Card className="p-5 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)]">
          <CardTitle>Progres Parameter</CardTitle>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-5 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)]">
        <CardTitle>AI Intake Agent</CardTitle>
        <p className="mt-1 text-xs text-[var(--text-soft)]">
          Mode: {mode === "surprise" ? "Surprise Me (AI pilih destinasi)" : "Standard (destinasi dari kamu)"}
        </p>

        <div className="mt-4 h-[380px] overflow-y-auto rounded-[1.2rem] border border-slate-200/70 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">
              {mode === "surprise"
                ? "Halo! Surprise mode aktif. Ceritakan dulu siapa yang ikut dan tanggal trip-nya."
                : "Halo! Kita mulai dari siapa yang ikut trip ini?"}
            </p>
          ) : (
            <div className="space-y-2">
              {normalizedMessages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "rounded-xl bg-[var(--brand-blue-soft)] p-2 text-sm text-blue-900"
                      : "rounded-xl border border-slate-200/70 bg-white p-2 text-sm"
                  }
                >
                  <p className="whitespace-pre-line leading-relaxed">
                    {message.role === "assistant"
                      ? toDisplayText(extractTextFromParts(message.parts))
                      : extractTextFromParts(message.parts)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="mt-3 flex gap-2"
        >
          <input
            className="h-11 flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none transition-all focus:border-[var(--brand)] focus:ring-2 focus:ring-[rgba(249,115,22,0.2)]"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={mode === "surprise" ? "Contoh: berdua, awal Juli, budget 12 juta" : "Tulis jawaban kamu..."}
          />
          <button
            type="submit"
            className="h-11 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[0_14px_24px_-16px_rgba(249,115,22,0.7)] transition hover:bg-[var(--brand-strong)]"
            disabled={isLoading}
          >
            {isLoading ? "..." : "Kirim"}
          </button>
        </form>

        <p className="mt-2 text-xs text-[var(--text-soft)]">
          {isIntakeCompleted
            ? "Intake selesai. Opsi trip akan diproses otomatis."
            : "Lanjut ke comparison akan aktif otomatis setelah AI menutup intake."}
        </p>

        {compareError ? <p className="mt-2 text-xs text-[var(--danger)]">{compareError}</p> : null}

        <button
          type="button"
          onClick={generateOptions}
          disabled={isGeneratingOptions || !isIntakeCompleted}
          className="mt-3 h-10 w-full rounded-full border border-[var(--border)] bg-white text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--bg-alt)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGeneratingOptions
            ? "Menyiapkan opsi..."
            : isIntakeCompleted
              ? "Lanjut ke Trip Comparison"
              : "Selesaikan intake dulu"}
        </button>
      </Card>

      <Card className="p-5 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)]">
        <CardTitle>Progres Parameter</CardTitle>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          {completed} / {requiredFields.length} parameter terkumpul
        </p>
        <Progress className="mt-3" value={progress} />
        <div className="mt-4 space-y-2 text-sm">
          {requiredFields.map((field) => {
              const done = isFieldCompleted(field, userOnlyConversationText);
            return (
               <div key={field} className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-[var(--bg-alt)] px-3 py-2">
                <span className="capitalize">{FIELD_LABELS[field] ?? field}</span>
                <span className={done ? "text-[var(--brand-strong)]" : "text-[var(--text-soft)]"}>{done ? "Selesai" : "Menunggu"}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
