"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { DefaultChatTransport } from "ai";

import { Card, CardTitle } from "@/components/ui/card";

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

export function EditorChat({
  tripId,
  userId,
}: {
  tripId: string;
  userId?: string;
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/editor",
      body: {
        tripId,
        userId,
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const normalizedMessages = normalizeMessages(
    messages as Array<{
      id: string;
      role: "assistant" | "user" | "system";
      parts: Array<{ type: string; text?: string }>;
    }>,
  );

  const send = async () => {
    if (!input.trim() || isLoading) return;

    const text = input;
    setInput("");
    await sendMessage({ text });
  };

  return (
    <Card className="flex h-[540px] flex-col p-4">
      <CardTitle>AI Editor</CardTitle>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl bg-[var(--bg-alt)] p-3">
        {normalizedMessages.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">Contoh: &quot;Tukar resto hari 2 ke opsi vegetarian yang lebih dekat&quot;</p>
        ) : (
          normalizedMessages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "rounded-xl bg-[#d9efe4] p-2 text-sm" : "rounded-xl bg-white p-2 text-sm"}>
              {extractTextFromParts(message.parts)}
            </div>
          ))
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
          className="h-10 flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)]"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Edit itinerary..."
        />
        <button type="submit" className="rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]" disabled={isLoading}>
          {isLoading ? "..." : "Send"}
        </button>
      </form>
    </Card>
  );
}
