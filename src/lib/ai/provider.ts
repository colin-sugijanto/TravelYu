import { createOpenAI } from "@ai-sdk/openai";
import { GOOGLE_AI_STUDIO_MODEL } from "@/lib/constants";

const googleAiStudioApiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;

export const googleAiStudio = createOpenAI({
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
  apiKey: googleAiStudioApiKey,
});

const googleModelId = process.env.GOOGLE_AI_STUDIO_MODEL ?? GOOGLE_AI_STUDIO_MODEL;

const hasGoogleAiStudioKey =
  typeof googleAiStudioApiKey === "string" && googleAiStudioApiKey.trim().length > 0;

export const hasConfiguredAiProvider = hasGoogleAiStudioKey;

export const model = googleAiStudio.chat(googleModelId);
