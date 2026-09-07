import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const limiters = new Map<string, Ratelimit>();
const memoryCache = new Map();

function getRedisInstance(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export function getScopedRateLimiter(scope: string): Ratelimit | null {
  const redis = getRedisInstance();
  if (!redis) return null;

  if (limiters.has(scope)) {
    return limiters.get(scope)!;
  }

  let slidingConfig: Parameters<typeof Ratelimit.slidingWindow>;

  switch (scope) {
    case "generate-trip":
      slidingConfig = [3, "10 m"];
      break;
    case "compare-options":
      slidingConfig = [5, "5 m"];
      break;
    case "intake":
    case "editor":
      slidingConfig = [15, "1 m"];
      break;
    default:
      slidingConfig = [10, "1 m"];
  }

  const instance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(...slidingConfig),
    ephemeralCache: memoryCache,
    analytics: true,
    prefix: `travelyu_${scope}_rl`,
  });

  limiters.set(scope, instance);
  return instance;
}

export function getRateLimiter() {
  return getScopedRateLimiter("general");
}

export async function checkAiRateLimit(userId: string, scope = "general"): Promise<Response | null> {
  const ratelimiter = getScopedRateLimiter(scope);
  if (!ratelimiter) return null;

  const { success, reset } = await ratelimiter.limit(`ai:${scope}:${userId}`);
  if (success) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

  return new Response(JSON.stringify({ error: "Layanan AI sedang sibuk. Mohon tunggu sebentar sebelum mencoba lagi." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

export async function checkApiRateLimit(userId: string, scope = "general"): Promise<Response | null> {
  const ratelimiter = getScopedRateLimiter(scope);
  if (!ratelimiter) return null;

  const { success, reset } = await ratelimiter.limit(`api:${scope}:${userId}`);
  if (success) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

  return new Response(JSON.stringify({ error: "Terlalu banyak permintaan. Mohon tunggu sejenak." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}
