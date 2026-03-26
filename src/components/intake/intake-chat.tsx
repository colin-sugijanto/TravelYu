"use client";

import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { INTAKE_FIELDS } from "@/lib/constants";
import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DefaultChatTransport } from "ai";

const INTAKE_COMPLETE_TOKEN = "[INTAKE_COMPLETE]";

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

export function IntakeChat({ tripId, mode }: IntakeChatProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const autoAdvanceTriggeredRef = useRef(false);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/intake",
      body: {
        tripId,
        mode,
      },
    }),
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

  const isIntakeCompleted = useMemo(
    () =>
      messageTexts.some(
        (message) => message.role === "assistant" && message.text.includes(INTAKE_COMPLETE_TOKEN),
      ),
    [messageTexts],
  );

  const flattenedText = useMemo(
    () => messageTexts.map((message) => stripControlTokens(message.text)).join("\n"),
    [messageTexts],
  );

  const completed = useMemo(() => {
    const content = flattenedText.toLowerCase();
    return INTAKE_FIELDS.filter((field) => content.includes(field.toLowerCase())).length;
  }, [flattenedText]);

  const progress = Math.round((completed / INTAKE_FIELDS.length) * 100);

  const send = async () => {
    if (!input.trim() || isLoading) return;

    const text = input;
    setInput("");
    await sendMessage({ text });
  };

  const generateOptions = useCallback(async () => {
    if (isGeneratingOptions || !flattenedText.trim()) return;

    setIsGeneratingOptions(true);
    setCompareError(null);

    try {
      const response = await fetch("/api/ai/compare-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          intakeSummary: flattenedText,
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
  }, [flattenedText, isGeneratingOptions, router, tripId]);

  useEffect(() => {
    if (!isIntakeCompleted || autoAdvanceTriggeredRef.current) return;
    autoAdvanceTriggeredRef.current = true;
    void generateOptions();
  }, [generateOptions, isIntakeCompleted]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-5">
        <CardTitle>AI Intake Agent</CardTitle>
        <p className="mt-1 text-xs text-[var(--text-soft)]">Mode: {mode === "surprise" ? "Surprise Me" : "Standard"}</p>
        <div className="mt-4 h-[380px] overflow-y-auto rounded-xl bg-[var(--bg-alt)] p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">Halo! Kita mulai dari siapa yang ikut trip ini?</p>
          ) : (
            <div className="space-y-2">
              {normalizedMessages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === "user" ? "rounded-xl bg-blue-100 text-blue-900 p-2 text-sm" : "rounded-xl bg-white p-2 text-sm"}
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
            className="h-11 flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)]"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tulis jawaban kamu..."
          />
          <button
            type="submit"
            className="h-11 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
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

      <Card className="p-5">
        <CardTitle>Parameter Progress</CardTitle>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          {completed} / {INTAKE_FIELDS.length} parameter terkumpul
        </p>
        <Progress className="mt-3" value={progress} />
        <div className="mt-4 space-y-2 text-sm">
          {INTAKE_FIELDS.map((field) => {
            const done = flattenedText.toLowerCase().includes(field.toLowerCase());
            return (
              <div key={field} className="flex items-center justify-between rounded-lg bg-[var(--bg-alt)] px-3 py-2">
                <span className="capitalize">{field}</span>
                <span className={done ? "text-[var(--brand-strong)]" : "text-[var(--text-soft)]"}>{done ? "Done" : "Pending"}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
