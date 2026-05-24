export const APP_NAME = "TravelYu!";

export const OPENROUTER_CHAT_MODEL = "deepseek/deepseek-v4-flash";

export const GOOGLE_AI_STUDIO_MODEL = "gemini-3.1-flash-lite-preview";

export const INTAKE_FIELDS = [
  "who",
  "vibe",
  "when",
  "where",
  "budget",
  "pacing",
  "specialNeeds",
] as const;

export const LOYALTY_TIERS = {
  explorer: { min: 0, max: 499 },
  adventurer: { min: 500, max: 1999 },
  wanderer: { min: 2000, max: Number.POSITIVE_INFINITY },
};
