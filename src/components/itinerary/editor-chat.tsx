"use client";

import { useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function EditorChat({ tripId }: { tripId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, messages: nextMessages }),
      });

      const payload = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.text ?? "Maaf, ada gangguan saat memproses edit itinerary.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex h-[540px] flex-col p-4">
      <CardTitle>AI Editor</CardTitle>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl bg-[var(--bg-alt)] p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">Contoh: &quot;Tukar resto hari 2 ke opsi vegetarian yang lebih dekat&quot;</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "rounded-xl bg-[#d9efe4] p-2 text-sm" : "rounded-xl bg-white p-2 text-sm"}>
              {message.content}
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
