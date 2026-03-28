"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import { supabaseRealtime, subscribeToCsChat } from "@/lib/realtime";
import type { CSChatSession } from "@/types/domain";

interface CSChatPanelProps {
  initialSessions: CSChatSession[];
}

function extractSessionMessages(session: CSChatSession | null) {
  if (!session) return [];
  return Array.isArray(session.messages) ? session.messages : [];
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function mergeSessions(
  base: CSChatSession[],
  realtimeById: Record<string, CSChatSession>,
): CSChatSession[] {
  const seen = new Set<string>();
  const merged: CSChatSession[] = [];

  for (const session of base) {
    const replacement = realtimeById[session.id];
    merged.push(replacement ?? session);
    seen.add(session.id);
  }

  const realtimeOnly = Object.values(realtimeById).filter((session) => !seen.has(session.id));
  merged.push(...realtimeOnly);

  return merged.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function CSChatPanel({ initialSessions }: CSChatPanelProps) {
  const [realtimeById, setRealtimeById] = useState<Record<string, CSChatSession>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [value, setValue] = useState("");

  const sessions = useMemo(
    () => mergeSessions(initialSessions, realtimeById),
    [initialSessions, realtimeById],
  );

  const activeSessionId = selectedSessionId ?? sessions[0]?.id ?? null;

  useEffect(() => {
    const channel = supabaseRealtime
      .channel("admin-cs-chat")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cs_chat_sessions",
        },
        (payload) => {
          const row = payload.new as CSChatSession;
          if (!row?.id) return;

          setRealtimeById((prev) => ({
            ...prev,
            [row.id]: row,
          }));
        },
      )
      .subscribe();

    return () => {
      void supabaseRealtime.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;

    const unsubscribe = subscribeToCsChat(activeSessionId, (payload) => {
      const row = (payload as { new?: CSChatSession }).new;
      if (!row?.id) return;

      setRealtimeById((prev) => ({
        ...prev,
        [row.id]: row,
      }));
    });

    return unsubscribe;
  }, [activeSessionId]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const messages = extractSessionMessages(activeSession);

  const sendReply = async () => {
    if (!activeSession || !value.trim()) return;

    const newMessage = {
      role: "cs" as const,
      content: value.trim(),
      ts: new Date().toISOString(),
    };

    const nextMessages = [...messages, newMessage];
    setValue("");

    setRealtimeById((prev) => ({
      ...prev,
      [activeSession.id]: {
        ...activeSession,
        messages: nextMessages,
        updated_at: new Date().toISOString(),
      },
    }));

    const response = await fetch(`/api/admin/chat/${encodeURIComponent(activeSession.id)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: newMessage.content,
      }),
    });

    if (!response.ok) {
      setRealtimeById((prev) => ({
        ...prev,
        [activeSession.id]: activeSession,
      }));
      return;
    }

    const payload = (await response.json().catch(() => null)) as { session?: CSChatSession } | null;
    const confirmedSession = payload?.session;
    if (confirmedSession) {
      setRealtimeById((prev) => ({
        ...prev,
        [activeSession.id]: confirmedSession,
      }));
    }
  };

  return (
    <Card className="grid h-[560px] gap-4 p-4 md:grid-cols-[300px_1fr]">
      <div className="overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-2">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">
          Open Sessions
        </p>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="px-2 text-sm text-[var(--text-soft)]">No open chat session.</p>
          ) : null}

          {sessions
            .filter((session) => session.status === "open")
            .map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  activeSessionId === session.id
                    ? "border-[var(--brand)] bg-white"
                    : "border-[var(--border)] bg-white/70"
                }`}
              >
                <p className="font-semibold">Trip {session.trip_id.slice(0, 8)}</p>
                <p className="text-xs text-[var(--text-soft)]">Updated {formatTs(session.updated_at)}</p>
              </button>
            ))}

          {sessions.filter((session) => session.status === "open").length === 0 ? (
            <p className="px-2 text-sm text-[var(--text-soft)]">No open sessions.</p>
          ) : null}
        </div>
      </div>

      <div className="flex h-full flex-col">
        <CardTitle>Live Chat Sessions</CardTitle>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl bg-[var(--bg-alt)] p-3">
          {messages.map((message, idx) => (
            <div
              key={`${message.role}-${idx}-${message.ts}`}
              className={
                message.role === "cs"
                  ? "rounded-xl bg-blue-100 text-blue-900 p-2 text-sm"
                  : "rounded-xl bg-white p-2 text-sm"
              }
            >
              <p>{message.content}</p>
              <p className="mt-1 text-[10px] uppercase text-[var(--text-soft)]">{formatTs(message.ts)}</p>
            </div>
          ))}

          {activeSession === null ? (
            <p className="text-sm text-[var(--text-soft)]">Pilih session untuk mulai membalas.</p>
          ) : null}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendReply();
          }}
        >
          <input
            className="h-10 flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)]"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Balas user..."
            disabled={!activeSession}
          />
          <button
            type="submit"
            disabled={!activeSession}
            className="rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </Card>
  );
}
