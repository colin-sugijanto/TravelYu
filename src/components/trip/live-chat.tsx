"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardText, CardTitle } from "@/components/ui/card";
import { subscribeToCsChat } from "@/lib/realtime";
import type { CSChatMessage, CSChatSession } from "@/types/domain";

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface TripLiveChatProps {
  tripId: string;
}

export function TripLiveChat({ tripId }: TripLiveChatProps) {
  const [session, setSession] = useState<CSChatSession | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/chat`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json().catch(() => null)) as { session?: CSChatSession | null } | null;
        if (!mounted) return;

        setSession(payload?.session ?? null);
      } catch {
        // noop
      }
    };

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  useEffect(() => {
    if (!session?.id) return;

    const unsubscribe = subscribeToCsChat(session.id, (payload) => {
      const row = (payload as { new?: CSChatSession }).new;
      if (!row?.id) return;

      setSession(row);
    });

    return unsubscribe;
  }, [session?.id]);

  const messages = useMemo<CSChatMessage[]>(() => {
    if (!session || !Array.isArray(session.messages)) return [];
    return session.messages;
  }, [session]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || loading) return;

    setLoading(true);
    setError(null);

    const optimistic: CSChatMessage = {
      role: "user",
      content,
      ts: new Date().toISOString(),
    };

    if (session) {
      setSession({
        ...session,
        messages: [...messages, optimistic],
        updated_at: new Date().toISOString(),
      });
    }
    setInput("");

    try {
      const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Gagal mengirim chat ke CS.");
        return;
      }

      const payload = (await response.json().catch(() => null)) as { session?: CSChatSession } | null;
      if (payload?.session) {
        setSession(payload.session);
      }
    } catch {
      setError("Gagal mengirim chat ke CS.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex h-[440px] flex-col p-4">
      <CardTitle>Live Chat ke CS</CardTitle>
      <CardText className="mt-1">Chat tersimpan dan akan muncul kembali saat halaman di-refresh.</CardText>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl bg-[var(--bg-alt)] p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">Belum ada chat. Kirim pesan untuk menghubungi CS.</p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${message.ts}-${index}`}
              className={
                message.role === "user"
                  ? "rounded-xl bg-blue-100 p-2 text-sm text-blue-900"
                  : "rounded-xl bg-white p-2 text-sm"
              }
            >
              <p>{message.content}</p>
              <p className="mt-1 text-[10px] uppercase text-[var(--text-soft)]">{formatTs(message.ts)}</p>
            </div>
          ))
        )}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <input
          className="h-10 flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)]"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tulis pesan untuk CS..."
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "..." : "Kirim"}
        </button>
      </form>

      {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </Card>
  );
}
