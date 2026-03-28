import { createOpenAI } from "@ai-sdk/openai";
import { OPENROUTER_MODEL } from "@/lib/constants";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRequestUrl(input: Parameters<typeof fetch>[0]): string | undefined {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return undefined;
}

function shouldUseJsonObjectResponseFormat(body: Record<string, unknown>): boolean {
  const modelId = typeof body.model === "string" ? body.model.toLowerCase() : "";
  return modelId.startsWith("stepfun/");
}

function normalizeResponseFormat(body: Record<string, unknown>): {
  body: Record<string, unknown>;
  changed: boolean;
} {
  const responseFormat = isObject(body.response_format) ? body.response_format : null;
  if (!responseFormat) return { body, changed: false };

  if (responseFormat.type !== "json_schema") {
    return { body, changed: false };
  }

  if (!shouldUseJsonObjectResponseFormat(body)) {
    return { body, changed: false };
  }

  return {
    body: {
      ...body,
      response_format: { type: "json_object" },
    },
    changed: true,
  };
}

const fetchWithDevGuardrailRelaxation: typeof fetch = async (input, init) => {
  const isDev = process.env.NODE_ENV !== "production";
  const requestUrl = getRequestUrl(input);
  const isTextGenerationEndpoint =
    requestUrl?.includes("openrouter.ai/api/v1/responses") ||
    requestUrl?.includes("openrouter.ai/api/v1/chat/completions") ||
    requestUrl?.includes("openrouter.ai/api/v1/completions");

  if (!isTextGenerationEndpoint || typeof init?.body !== "string") {
    return fetch(input, init);
  }

  try {
    const parsedBody = JSON.parse(init.body) as unknown;
    if (!isObject(parsedBody)) return fetch(input, init);

    const normalized = normalizeResponseFormat(parsedBody);
    let nextBody: Record<string, unknown> = normalized.body;
    let changed = normalized.changed;

    if (!isDev) {
      if (!changed) return fetch(input, init);

      return fetch(input, {
        ...init,
        body: JSON.stringify(nextBody),
      });
    }

    const provider = isObject(nextBody.provider) ? nextBody.provider : {};

    nextBody = {
      ...nextBody,
      provider: {
        ...provider,
        data_collection: "allow",
        allow_fallbacks: true,
      },
    };
    changed = true;

    if (!changed) return fetch(input, init);

    return fetch(input, {
      ...init,
      body: JSON.stringify(nextBody),
    });
  } catch {
    return fetch(input, init);
  }
};

export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  fetch: fetchWithDevGuardrailRelaxation,
});

const modelId = process.env.OPENROUTER_MODEL ?? OPENROUTER_MODEL;

// Force Chat Completions compatibility for OpenRouter providers/models.
// The default OpenAI provider call path uses Responses API, which can reject
// multi-turn assistant history for some providers.
export const model = openrouter.chat(modelId);
