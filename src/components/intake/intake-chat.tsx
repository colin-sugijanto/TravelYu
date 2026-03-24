"use client";

import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { INTAKE_FIELDS } from "@/lib/constants";
import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DefaultChatTransport } from "ai";

function extractTextFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
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
  const flattenedText = useMemo(
    () => normalizedMessages.map((message) => extractTextFromParts(message.parts)).join("\n"),
    [normalizedMessages],
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

  const generateOptions = async () => {
    if (isGeneratingOptions || normalizedMessages.length === 0) return;

    setIsGeneratingOptions(true);
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
        return;
      }

      router.push(`/trip/new/compare?tripId=${encodeURIComponent(tripId)}`);
    } finally {
      setIsGeneratingOptions(false);
    }
  };

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
                  className={message.role === "user" ? "rounded-xl bg-[#d9efe4] p-2 text-sm" : "rounded-xl bg-white p-2 text-sm"}
                >
                  <p>{extractTextFromParts(message.parts)}</p>
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

        <button
          type="button"
          onClick={generateOptions}
          disabled={isGeneratingOptions || normalizedMessages.length === 0}
          className="mt-3 h-10 w-full rounded-full border border-[var(--border)] bg-white text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--bg-alt)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGeneratingOptions ? "Menyiapkan opsi..." : "Lanjut ke Trip Comparison"}
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
