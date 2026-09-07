"use client";

import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

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

  const detectedVibes = VIBE_KEYWORDS.filter((keyword) =>
    normalized.includes(keyword),
  );
  if (detectedVibes.length > 0) payload.vibe = detectedVibes.join(", ");

  const destination = DESTINATION_KEYWORDS.find((keyword) =>
    normalized.includes(keyword),
  );
  if (destination) payload.where = destination;

  const whenMatch = normalized.match(
    /(\d{1,2}\s*[-–]\s*\d{1,2}\s+\w+|\w+\s+\d{4}|\d+\s*hari\s*\d*\s*malam|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i,
  );
  if (whenMatch) payload.when = whenMatch[0];

  const budgetMatch = normalized.match(
    /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(?:juta|ribu|k|rb)/i,
  );
  if (budgetMatch) payload.budget = budgetMatch[0];

  if (/\b(santai|pelan|slow)\b/i.test(normalized)) payload.pacing = "slow";
  else if (/\b(padat|packed|banyak)\b/i.test(normalized))
    payload.pacing = "packed";
  else if (/\b(balanced|seimbang)\b/i.test(normalized))
    payload.pacing = "balanced";

  if (
    /\b(vegetarian|vegan|halal|alergi|aksesibilitas|kursi roda|disabilitas|lansia|anak kecil)\b/i.test(
      normalized,
    )
  ) {
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
  budget: [/\b(budget|anggaran|biaya|rp\s?\d|juta|ribu)\b/i],
  pacing: [
    /\b(pacing|ritme|tempo|pelan|santai|padat|2-3 aktivitas|itinerary)\b/i,
  ],
  specialNeeds: [
    /\b(special\s*needs?|kebutuhan\s*khusus|preferensi\s*khusus|aksesibilitas|disabilitas)\b/i,
    /\b(halal|lift|kursi\s*roda|alergi|vegetarian|vegan|ramah\s*anak|tidak\s*ada|ga\s*ada|gak\s*ada|none)\b/i,
  ],
};

function hasAssistantCompletionSignal(
  messageTexts: Array<{ role: "assistant" | "user"; text: string }>,
) {
  return messageTexts.some((message) => {
    if (message.role !== "assistant") return false;

    const text = message.text;
    return text.includes(INTAKE_COMPLETE_TOKEN);
  });
}

function isFieldCompleted(field: string, content: string) {
  const patterns = FIELD_PATTERNS[field] ?? [];
  return patterns.some((pattern) => pattern.test(content));
}

function isFieldCompletedByPayload(field: string, payload: IntakeProgressPayload) {
  const value = payload[field as keyof IntakeProgressPayload];
  return typeof value === "string" && value.trim().length > 0;
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

  const inlineBulletCount = (formatted.match(/\s-\s(?=[A-Za-z0-9(])/g) ?? [])
    .length;
  if (!formatted.includes("\n- ") && inlineBulletCount >= 2) {
    formatted = formatted.replace(/\s-\s(?=[A-Za-z0-9(])/g, "\n- ");
  }

  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  const normalized = formatted.toLowerCase();
  const looksLikeMetaPromptLeak =
    normalized.includes("we need to follow instructions") ||
    normalized.includes("output only") ||
    normalized.includes("without additional context") ||
    normalized.includes("specified phrase") ||
    normalized.includes("strictly adhered") ||
    normalized.includes("prompt-injection");

  if (looksLikeMetaPromptLeak) {
    return "Siap, aku catat. Lanjut ya, kapan tanggal/periode trip kamu?";
  }

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
    .filter(
      (message) => message.role === "assistant" || message.role === "user",
    )
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

const REQUIRED_FIELDS_BY_MODE: Record<
  "standard" | "surprise",
  readonly string[]
> = {
  standard: INTAKE_FIELDS,
  surprise: ["who", "when", "budget", "pacing", "specialNeeds"],
};

const QUICK_REPLIES: Record<string, string[]> = {
  standard: [
    "Berdua dengan pasangan, 3 hari 2 malam",
    "Bali, awal bulan depan, budget 10 juta",
    "Santai, kuliner + budaya",
  ],
  surprise: [
    "Berdua, awal Juli, budget 12 juta",
    "Keluarga 4 orang, libur sekolah",
    "Solo trip santai, healing",
  ],
};

export function IntakeChat({ tripId, mode }: IntakeChatProps) {
  const router = useRouter();
  const requiredFields = REQUIRED_FIELDS_BY_MODE[mode];
  const [input, setInput] = useState("");
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [serverIntakeComplete, setServerIntakeComplete] = useState(false);
  const autoAdvanceTriggeredRef = useRef(false);
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);

  const saveMessages = useCallback(
    async (msgs: UIMessage[]) => {
      try {
        await fetch(`/api/trip/${encodeURIComponent(tripId)}/chat-history`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "intake",
            messages: msgs.map((m) => ({
              id: m.id,
              role: m.role,
              parts: m.parts,
            })),
          }),
        });
      } catch {
        // non-blocking
      }
    },
    [tripId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
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

  useEffect(() => {
    if (!chatLoaded) return;

    const id = window.setTimeout(() => {
      void saveMessages(messages);
    }, 350);

    return () => {
      window.clearTimeout(id);
    };
  }, [chatLoaded, messages, saveMessages]);

  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: status === "streaming" ? "smooth" : "auto",
    });
  }, [messages, status]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trip/${encodeURIComponent(tripId)}/chat-history?type=intake`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: UIMessage[] };
        if (
          !cancelled &&
          Array.isArray(data.messages) &&
          data.messages.length > 0
        ) {
          setMessages(data.messages as UIMessage[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChatLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, setMessages]);

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

  const flattenedText = useMemo(
    () =>
      messageTexts
        .map((message) => stripControlTokens(message.text))
        .join("\n"),
    [messageTexts],
  );

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
    return requiredFields.filter(
      (field) =>
        isFieldCompleted(field, userOnlyConversationText) ||
        isFieldCompletedByPayload(field, intakeProgressPayload),
    ).length;
  }, [intakeProgressPayload, requiredFields, userOnlyConversationText]);

  const tokenDetectedComplete = useMemo(() => {
    if (completed < requiredFields.length) return false;
    return hasAssistantCompletionSignal(messageTexts);
  }, [completed, messageTexts, requiredFields.length]);

  const isIntakeCompleted = serverIntakeComplete || tokenDetectedComplete;

  const modeToggleHref = useMemo(() => {
    const nextMode = mode === "surprise" ? "standard" : "surprise";
    return `/trip/new/intake?mode=${nextMode}&tripId=${encodeURIComponent(tripId)}`;
  }, [mode, tripId]);

  const modeToggleLabel =
    mode === "surprise" ? "Pindah ke Standard Mode" : "Pindah ke Surprise Me";

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
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setCompareError(
          payload?.error ??
            "Gagal membuat opsi comparison. Coba kirim 1 pesan konfirmasi lagi.",
        );
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
  }, [
    intakeProgressPayload,
    serverIntakeComplete,
    tripId,
    userOnlyConversationText,
  ]);

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
  }, [
    isLoading,
    messageTexts,
    mode,
    tokenDetectedComplete,
    tripId,
    userOnlyConversationText,
  ]);

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
          <div className="mt-4 h-95 flex items-center justify-center">
            <p className="text-sm text-(--text-soft)">Memuat riwayat chat...</p>
          </div>
        </Card>
        <Card className="p-5 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)]">
          <CardTitle>Progres Parameter</CardTitle>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/trip/new" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
          ← Pilih mode lain
        </Link>
        <ol className="flex items-center gap-1.5 text-[11px] font-bold" aria-label="Langkah pembuatan trip">
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">1 · Mode</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-zinc-900 px-2.5 py-1 text-white">2 · Intake</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">3 · Opsi</li>
          <li className="text-zinc-300">→</li>
          <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">4 · Itinerary</li>
        </ol>
      </div>
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-5 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)]">
        <CardTitle>AI Intake Agent</CardTitle>
        <p className="mt-1 text-xs text-(--text-soft)">
          Mode:{" "}
          {mode === "surprise"
            ? "Surprise Me (AI pilih destinasi)"
            : "Standard (destinasi dari kamu)"}{" "}
          · {completed}/{requiredFields.length} terkumpul · 1 kredit/pesan
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href={modeToggleHref}
            className="inline-flex items-center rounded-full border border-(--border) bg-white px-3 py-1 text-xs font-semibold text-(--text-soft) transition hover:bg-(--bg-alt)"
          >
            {modeToggleLabel}
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            Simpan & keluar
          </Link>
        </div>

        <div
          ref={messageContainerRef}
          className="mt-4 h-95 overflow-y-auto rounded-[1.2rem] border border-slate-200/70 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-3"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-(--text-soft)">
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
                      ? "rounded-xl bg-(--brand-blue-soft) p-2 text-sm text-blue-900"
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
          <label htmlFor="intake-input" className="sr-only">Tulis jawaban kamu</label>
          <input
            id="intake-input"
            className="h-11 flex-1 rounded-full border border-(--border) bg-white px-4 text-sm outline-none transition-all focus:border-(--brand) focus:ring-2 focus:ring-[rgba(249,115,22,0.2)]"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              mode === "surprise"
                ? "Contoh: berdua, awal Juli, budget 12 juta"
                : "Tulis jawaban kamu..."
            }
            autoComplete="off"
          />
          <button
            type="submit"
            className="h-11 rounded-full bg-(--brand) px-4 text-sm font-semibold text-white shadow-[0_14px_24px_-16px_rgba(249,115,22,0.7)] transition hover:bg-(--brand-strong) disabled:opacity-60"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? "..." : "Kirim"}
          </button>
        </form>

        {messages.length <= 1 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {QUICK_REPLIES[mode].map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setInput(chip);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}

        <p className="mt-2 text-xs text-(--text-soft)">
          {isIntakeCompleted
            ? "Intake selesai. Opsi trip akan diproses otomatis."
            : "Lanjut ke comparison akan aktif otomatis setelah AI menutup intake."}
        </p>

        {compareError ? (
          <p className="mt-2 text-xs text-(--danger)">{compareError}</p>
        ) : null}

        <button
          type="button"
          onClick={generateOptions}
          disabled={isGeneratingOptions || !isIntakeCompleted}
          className="mt-3 h-10 w-full rounded-full border border-(--border) bg-white text-sm font-semibold text-foreground transition hover:bg-(--bg-alt) disabled:cursor-not-allowed disabled:opacity-60"
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
        <p className="mt-2 text-sm text-(--text-soft)">
          {completed} / {requiredFields.length} parameter terkumpul
        </p>
        <Progress className="mt-3" value={progress} />
        <div className="mt-4 space-y-2 text-sm">
          {requiredFields.map((field) => {
              const done =
                isFieldCompleted(field, userOnlyConversationText) ||
                isFieldCompletedByPayload(field, intakeProgressPayload);
              const value = intakeProgressPayload[field as keyof IntakeProgressPayload];
            return (
              <div
                key={field}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-(--bg-alt) px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block capitalize font-medium">
                    {FIELD_LABELS[field] ?? field}
                  </span>
                  {done && typeof value === "string" && value.trim() ? (
                    <span className="block truncate text-xs text-slate-500" title={value}>
                      {value.slice(0, 60)}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-(--text-soft)"
                  }`}
                >
                  {done ? "✓ Selesai" : "Menunggu"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-700">
          💡 Tips: jawab santai dalam 1 kalimat (contoh: “berdua, Bali 3 hari, budget 8 juta, santai”). Progress tersimpan otomatis — aman keluar kapan saja.
        </p>
      </Card>
    </div>
    </div>
  );
}
