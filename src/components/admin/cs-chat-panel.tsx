"use client";

import { useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";

const initialMessages = [
  { from: "user", text: "Halo, saya mau ubah hotel untuk malam terakhir" },
  { from: "cs", text: "Siap, kami cek ketersediaan vendor dulu ya." },
];

export function CSChatPanel() {
  const [messages, setMessages] = useState(initialMessages);
  const [value, setValue] = useState("");

  return (
    <Card className="flex h-[540px] flex-col p-4">
      <CardTitle>Live Chat Sessions</CardTitle>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl bg-[var(--bg-alt)] p-3">
        {messages.map((message, idx) => (
          <div key={`${message.from}-${idx}`} className={message.from === "cs" ? "rounded-xl bg-[#d9efe4] p-2 text-sm" : "rounded-xl bg-white p-2 text-sm"}>
            {message.text}
          </div>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.trim()) return;
          setMessages((prev) => [...prev, { from: "cs", text: value }]);
          setValue("");
        }}
      >
        <input
          className="h-10 flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)]"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Balas user..."
        />
        <button type="submit" className="rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]">
          Send
        </button>
      </form>
    </Card>
  );
}
