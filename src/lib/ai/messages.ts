import type { ModelMessage, UIMessage } from "ai";

type LegacyMessage = {
  role: "user" | "assistant";
  content: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyMessage(value: unknown): value is LegacyMessage {
  return (
    isObject(value) &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"
  );
}

function isUiMessage(value: unknown): value is UIMessage {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant" || value.role === "system") &&
    Array.isArray(value.parts)
  );
}

type ToolInvocationLike = {
  toolName?: string;
  result?: Record<string, unknown>;
  output?: Record<string, unknown>;
  state?: string;
};

type UiMessagePart = {
  type?: string;
  text?: string;
  toolInvocation?: ToolInvocationLike;
  toolName?: string;
  result?: Record<string, unknown>;
  output?: Record<string, unknown>;
  state?: string;
};

function getToolResult(part: UiMessagePart) {
  const invocation = part.toolInvocation;
  if (invocation?.toolName && (invocation.result || invocation.output)) {
    return {
      toolName: invocation.toolName,
      result: (invocation.result ?? invocation.output) as Record<string, unknown>,
    };
  }

  const type = typeof part.type === "string" ? part.type : "";
  if (type.startsWith("tool-")) {
    const inferredToolName = part.toolName ?? type.replace(/^tool-/, "");
    const result = (part.result ?? part.output) as Record<string, unknown> | undefined;
    if (inferredToolName && result) {
      return { toolName: inferredToolName, result };
    }
  }

  if (part.toolName && (part.result || part.output)) {
    return {
      toolName: part.toolName,
      result: (part.result ?? part.output) as Record<string, unknown>,
    };
  }

  return null;
}

function formatToolResultText(toolName: string, result: Record<string, unknown>) {
  if (toolName === "search_alternatives") {
    const alternatives = Array.isArray(result.alternatives)
      ? (result.alternatives as Array<Record<string, unknown>>)
      : [];
    if (alternatives.length === 0) return "Alternatif: (tidak ada)";

    const lines = alternatives.slice(0, 5).map((alt, index) => {
      const name = typeof alt?.name === "string" ? alt.name : `Opsi ${index + 1}`;
      const city = typeof alt?.city === "string" ? alt.city : null;
      const url = typeof alt?.url === "string" ? alt.url : null;
      const meta = [city].filter(Boolean).join(" · ");
      const titleLine = `${index + 1}) ${name}${meta ? ` (${meta})` : ""}`;
      return url ? `${titleLine}\n${url}` : titleLine;
    });

    return `Alternatif:\n${lines.join("\n")}`;
  }

  return "";
}

function extractTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  const texts: string[] = [];

  for (const part of parts as UiMessagePart[]) {
    if (part.type === "text") {
      if (part.text) texts.push(part.text);
      continue;
    }

    const toolResult = getToolResult(part);
    if (toolResult) {
      const formatted = formatToolResultText(toolResult.toolName, toolResult.result);
      if (formatted) texts.push(formatted);
    }
  }

  return texts.join("\n").trim();
}

export async function toModelMessages(input: unknown): Promise<ModelMessage[]> {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item): ModelMessage[] => {
    if (isLegacyMessage(item)) {
      const content = item.content.trim();
      if (!content) return [];
      return [{ role: item.role, content }];
    }

    if (!isUiMessage(item)) return [];

    const content = extractTextFromParts(item.parts as Array<{ type: string; text?: string }>);
    if (!content) return [];

    return [{ role: item.role, content }];
  });
}

export function extractPlainTextMessages(input: unknown): LegacyMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item): item is LegacyMessage | UIMessage => isLegacyMessage(item) || isUiMessage(item))
    .map((item) => {
      if (isLegacyMessage(item)) return item;

      const content = extractTextFromParts(item.parts as Array<{ type: string; text?: string }>);

      return {
        role: item.role === "system" ? "assistant" : item.role,
        content,
      };
    })
    .filter((message) => message.content.length > 0);
}
