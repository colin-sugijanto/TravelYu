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

function extractTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
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
