import { createOpenAI } from "@ai-sdk/openai";
import { OPENROUTER_CHAT_MODEL } from "@/lib/constants";

const openrouterApiKey = process.env.OPENROUTER_API_KEY;

const hasOpenRouterKey =
  typeof openrouterApiKey === "string" && openrouterApiKey.trim().length > 0;

export const hasConfiguredOpenRouter = hasOpenRouterKey;

export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: openrouterApiKey,
});

const openrouterModelId = process.env.OPENROUTER_MODEL ?? OPENROUTER_CHAT_MODEL;

export const model = openrouter.chat(openrouterModelId);
