"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DefaultChatTransport, type UIMessage } from "ai";

import { Card, CardTitle } from "@/components/ui/card";

type MessagePart = {
  type: string;
  text?: string;
  toolInvocation?: {
    toolName: string;
    args?: Record<string, unknown>;
    state?: string;
    result?: Record<string, unknown>;
  };
  toolName?: string;
  args?: Record<string, unknown>;
  state?: string;
  result?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
};

type ToolResult = Record<string, unknown>;

const TOOL_LABELS: Record<string, string> = {
  update_itinerary_item: "Update aktivitas",
  add_itinerary_item: "Tambah aktivitas",
  delete_itinerary_item: "Hapus aktivitas",
  swap_vendor: "Ganti vendor",
  flag_for_cs_approval: "Kirim ke CS",
  search_alternatives: "Cari alternatif",
  generate_packing_list: "Generate packing list",
  get_weather_info: "Cek cuaca",
  escalate_to_human_cs: "Hubungi CS",
};

function formatToolName(name: string) {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

function toText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function renderToolSuccessSummary(toolName: string, result: ToolResult) {
  if (toolName === "search_alternatives") {
    const alternatives = Array.isArray(result.alternatives) ? result.alternatives : [];
    return alternatives.length > 0
      ? `✅ Ditemukan ${alternatives.length} alternatif.`
      : "✅ Tidak ada alternatif yang cocok saat ini.";
  }

  if (toolName === "get_weather_info") {
    const city = toText(result.city) ?? "lokasi";
    const summary = toText(result.summary) ?? "kondisi belum tersedia";
    const temp = typeof result.temp === "number" ? `${result.temp}°C` : null;
    return `✅ Cuaca ${city}: ${summary}${temp ? ` (${temp})` : ""}.`;
  }

  if (toolName === "generate_packing_list") {
    const items = Array.isArray(result.items) ? result.items : [];
    return `✅ Packing list berhasil dibuat (${items.length} item).`;
  }

  if (toolName === "escalate_to_human_cs") {
    const sessionId = toText(result.sessionId);
    return sessionId
      ? `✅ Permintaan sudah diteruskan ke CS (session ${sessionId}).`
      : "✅ Permintaan sudah diteruskan ke CS.";
  }

  if (toolName === "contact_vendor_via_whatsapp") {
    if (result.queued === true) {
      return "✅ Pesan ke vendor sudah masuk antrean WhatsApp.";
    }
    return "✅ Permintaan kontak vendor diproses.";
  }

  if (toolName === "flag_for_cs_approval") {
    return "✅ Perubahan sudah dikirim ke antrean approval CS.";
  }

  if (result.flagged === true) {
    return "✅ Perubahan ditandai dan menunggu approval CS.";
  }

  return "✅ Perubahan berhasil disimpan.";
}

function renderToolErrorSummary(result: ToolResult) {
  const message =
    toText(result.error) ??
    toText(result.reason) ??
    "Perubahan gagal diproses.";

  return `❌ ${message}`;
}

function getToolInvocation(part: MessagePart) {
  if (part.toolInvocation) return part.toolInvocation;

  if (part.type.startsWith("tool-")) {
    const inferredToolName = part.toolName ?? part.type.replace(/^tool-/, "");
    const normalizedState = part.state ?? (part.output ? "result" : "call");
    return {
      toolName: inferredToolName,
      args: part.args,
      state: normalizedState,
      result: part.result ?? part.output,
    };
  }

  if (typeof part.toolName === "string") {
    return {
      toolName: part.toolName,
      args: part.args,
      state: part.state,
      result: part.result,
    };
  }

  return null;
}

function renderMessageParts(parts: MessagePart[]) {
  const rendered = parts.map((part, idx) => {
    if (part.type === "text") {
      if (!part.text || !part.text.trim()) return null;
      return (
        <p key={idx} className="whitespace-pre-line text-sm leading-relaxed">
          {part.text}
        </p>
      );
    }

    const toolInvocation = getToolInvocation(part);
    const isToolPart =
      part.type === "tool-invocation" ||
      part.type === "tool-call" ||
      part.type === "tool-result" ||
      toolInvocation !== null;

    if (isToolPart && toolInvocation) {
      const inv = toolInvocation;
      const isRunning = inv.state === "call" || inv.state === "running" || !inv.result;
      const isOk = inv.result?.ok === true;
      return (
        <div key={idx} className="mt-2 space-y-1">
          {/* Tool call badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700">
            🔧 {formatToolName(inv.toolName)}
            {isRunning && <span className="animate-pulse">…</span>}
          </div>

          {/* Result */}
          {inv.result !== undefined && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                isOk
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {isOk
                ? renderToolSuccessSummary(inv.toolName, inv.result)
                : renderToolErrorSummary(inv.result)}
            </div>
          )}
        </div>
      );
    }

    if (part.errorText && part.errorText.trim()) {
      return (
        <p key={idx} className="whitespace-pre-line text-sm leading-relaxed text-red-700">
          ❌ {part.errorText.trim()}
        </p>
      );
    }

    if (part.text && part.text.trim()) {
      return (
        <p key={idx} className="whitespace-pre-line text-sm leading-relaxed">
          {part.text}
        </p>
      );
    }

    return null;
  });

  return rendered.filter((node) => node !== null);
}

export function EditorChat({
  tripId,
}: {
  tripId: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/editor",
      body: { tripId },
    }),
    onFinish: ({ messages: msgs }) => {
      void saveMessages(msgs);
      router.refresh();
    },
  });

  const saveMessages = useCallback(
    async (msgs: UIMessage[]) => {
      try {
        await fetch(`/api/trip/${encodeURIComponent(tripId)}/chat-history`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "editor",
            messages: msgs.map((m) => ({ id: m.id, role: m.role, parts: m.parts })),
          }),
        });
      } catch {
        // non-blocking
      }
    },
    [tripId],
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trip/${encodeURIComponent(tripId)}/chat-history?type=editor`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: UIMessage[] };
        if (!cancelled && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages as UIMessage[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  };

  if (!loaded) {
    return (
      <Card className="flex h-[540px] flex-col p-4">
        <CardTitle>AI Editor</CardTitle>
        <div className="mt-3 flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-soft)]">Memuat riwayat chat...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex h-[540px] flex-col p-4">
      <CardTitle>AI Editor</CardTitle>
      <div className="mt-3 flex-1 space-y-3 overflow-y-auto rounded-xl bg-[var(--bg-alt)] p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">
            Contoh: &quot;Tukar resto hari 2 ke opsi vegetarian lebih dekat&quot;
          </p>
        ) : (
          messages
            .filter((m) => m.role === "assistant" || m.role === "user")
            .map((message) => {
              const parts = (message.parts ?? []) as MessagePart[];
              const rendered = renderMessageParts(parts);
              if (message.role === "assistant" && rendered.length === 0) {
                return (
                  <div key={message.id} className="rounded-xl bg-white p-2.5 shadow-sm">
                    <p className="text-sm text-[var(--text-soft)]">Perubahan sedang diproses.</p>
                  </div>
                );
              }
              return (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "rounded-xl bg-blue-100 text-blue-900 p-2.5"
                      : "rounded-xl bg-white p-2.5 shadow-sm"
                  }
                >
                  {message.role === "user" ? (
                    <p className="text-sm">{String((message.parts?.[0] as MessagePart | undefined)?.text ?? "")}</p>
                  ) : (
                    <div className="space-y-1">{rendered}</div>
                  )}
                </div>
              );
            })
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          className="h-10 flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Edit itinerary..."
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? "…" : "Send"}
        </button>
      </form>
    </Card>
  );
}
