"use client";

import { useMemo, useState } from "react";

import { INTAKE_FIELDS } from "@/lib/constants";
import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function IntakeChat() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const completed = useMemo(() => {
    const content = messages.map((message) => message.content.toLowerCase()).join("\n");
    return INTAKE_FIELDS.filter((field) => content.includes(field.toLowerCase())).length;
  }, [messages]);

  const progress = Math.round((completed / INTAKE_FIELDS.length) * 100);

  const send = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: LocalMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.text ?? "Maaf, terjadi gangguan. Coba ulangi.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-5">
        <CardTitle>AI Intake Agent</CardTitle>
        <div className="mt-4 h-[380px] overflow-y-auto rounded-xl bg-[var(--bg-alt)] p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">Halo! Kita mulai dari siapa yang ikut trip ini?</p>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === "user" ? "rounded-xl bg-[#d9efe4] p-2 text-sm" : "rounded-xl bg-white p-2 text-sm"}
                >
                  <p>{message.content}</p>
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
      </Card>

      <Card className="p-5">
        <CardTitle>Parameter Progress</CardTitle>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          {completed} / {INTAKE_FIELDS.length} parameter terkumpul
        </p>
        <Progress className="mt-3" value={progress} />
        <div className="mt-4 space-y-2 text-sm">
          {INTAKE_FIELDS.map((field) => {
            const done = messages.some((m) => m.content.toLowerCase().includes(field.toLowerCase()));
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
