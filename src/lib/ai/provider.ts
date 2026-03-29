import { createOpenAI } from "@ai-sdk/openai";
import { GOOGLE_AI_STUDIO_MODEL } from "@/lib/constants";

const googleAiStudioApiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;

export const googleAiStudio = createOpenAI({
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
  apiKey: googleAiStudioApiKey,
});

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: openRouterApiKey,
});

const googleModelId = process.env.GOOGLE_AI_STUDIO_MODEL ?? GOOGLE_AI_STUDIO_MODEL;
const openRouterGenerationModel = process.env.OPENROUTER_GENERATION_MODEL ?? `google/${googleModelId}`;

const hasGoogleAiStudioKey =
  typeof googleAiStudioApiKey === "string" && googleAiStudioApiKey.trim().length > 0;
const hasOpenRouterKey =
  typeof openRouterApiKey === "string" && openRouterApiKey.trim().length > 0;

export const hasConfiguredAiProvider = hasGoogleAiStudioKey || hasOpenRouterKey;

export const model = hasGoogleAiStudioKey
  ? googleAiStudio.chat(googleModelId)
  : openrouter.chat(openRouterGenerationModel);
