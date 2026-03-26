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

const fetchWithDevGuardrailRelaxation: typeof fetch = async (input, init) => {
  const isDev = process.env.NODE_ENV !== "production";
  const requestUrl = getRequestUrl(input);
  const isTextGenerationEndpoint =
    requestUrl?.includes("openrouter.ai/api/v1/responses") ||
    requestUrl?.includes("openrouter.ai/api/v1/chat/completions") ||
    requestUrl?.includes("openrouter.ai/api/v1/completions");

  if (!isDev || !isTextGenerationEndpoint || typeof init?.body !== "string") {
    return fetch(input, init);
  }

  try {
    const parsedBody = JSON.parse(init.body) as unknown;
    if (!isObject(parsedBody)) return fetch(input, init);

    const provider = isObject(parsedBody.provider) ? parsedBody.provider : {};

    const nextBody = {
      ...parsedBody,
      provider: {
        ...provider,
        data_collection: "allow",
        allow_fallbacks: true,
      },
    };

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

export const model = openrouter(modelId);
