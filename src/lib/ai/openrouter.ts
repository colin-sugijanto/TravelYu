import { createOpenAI } from "@ai-sdk/openai";
import { OPENROUTER_MODEL } from "@/lib/constants";

export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const model = openrouter(OPENROUTER_MODEL);
