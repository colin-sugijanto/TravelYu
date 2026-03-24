import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";

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

function toUiMessageWithoutId(message: LegacyMessage | UIMessage): Omit<UIMessage, "id"> {
  if (isLegacyMessage(message)) {
    return {
      role: message.role,
      parts: [{ type: "text", text: message.content }],
    };
  }

  return {
    role: message.role,
    parts: message.parts,
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}

export async function toModelMessages(input: unknown): Promise<ModelMessage[]> {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .filter((item) => isLegacyMessage(item) || isUiMessage(item))
    .map((item) => toUiMessageWithoutId(item));

  if (normalized.length === 0) return [];
  return convertToModelMessages(normalized);
}

export function extractPlainTextMessages(input: unknown): LegacyMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item): item is LegacyMessage | UIMessage => isLegacyMessage(item) || isUiMessage(item))
    .map((item) => {
      if (isLegacyMessage(item)) return item;

      const content = item.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim();

      return {
        role: item.role === "system" ? "assistant" : item.role,
        content,
      };
    })
    .filter((message) => message.content.length > 0);
}
