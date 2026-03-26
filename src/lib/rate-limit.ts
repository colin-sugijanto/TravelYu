import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null = null;

export function getRateLimiter() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!limiter) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "travelyu_ai_rl",
    });
  }

  return limiter;
}

export async function checkAiRateLimit(userId: string, scope = "general"): Promise<Response | null> {
  const ratelimiter = getRateLimiter();
  if (!ratelimiter) return null;

  const { success, reset } = await ratelimiter.limit(`ai:${scope}:${userId}`);
  if (success) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

  return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}
