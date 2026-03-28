function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function collectErrorCandidates(error: unknown): Array<Record<string, unknown>> {
  const queue: unknown[] = [error];
  const seen = new Set<Record<string, unknown>>();
  const out: Array<Record<string, unknown>> = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isObject(current) || seen.has(current)) continue;

    seen.add(current);
    out.push(current);

    if (isObject(current.cause)) queue.push(current.cause);
    if (isObject(current.lastError)) queue.push(current.lastError);

    if (Array.isArray(current.errors)) {
      for (const nested of current.errors) {
        queue.push(nested);
      }
    }
  }

  return out;
}

function getHeaderRecord(error: unknown): Record<string, string> {
  if (!isObject(error)) return {};

  const headers = error.responseHeaders;
  if (!isObject(headers)) return {};

  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key.toLowerCase()] = value;
    }
    return acc;
  }, {});
}

function inferStatusCode(error: unknown): number | null {
  const candidates = collectErrorCandidates(error);

  for (const candidate of candidates) {
    const direct = getNumber(candidate.statusCode) ?? getNumber(candidate.status);
    if (direct !== null) return direct;

    const responseBody = getString(candidate.responseBody)?.toLowerCase() ?? "";
    if (
      responseBody.includes('"code":429') ||
      responseBody.includes("too many requests") ||
      responseBody.includes("rate-limited") ||
      responseBody.includes("rate limit")
    ) {
      return 429;
    }

    const message = getString(candidate.message)?.toLowerCase() ?? "";
    if (message.includes("429") || message.includes("too many requests") || message.includes("rate-limited") || message.includes("rate limit")) {
      return 429;
    }
  }

  return null;
}

function inferRetryAfterSeconds(error: unknown): number | null {
  const candidates = collectErrorCandidates(error);

  for (const candidate of candidates) {
    const headers = getHeaderRecord(candidate);

    const retryAfterValue = headers["retry-after"];
    if (!retryAfterValue) continue;

    const parsed = Number.parseInt(retryAfterValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  return null;
}

export function parseAiProviderError(
  error: unknown,
  messages: {
    defaultMessage: string;
    rateLimitedMessage: string;
  },
) {
  const statusCode = inferStatusCode(error);
  const retryAfterSeconds = inferRetryAfterSeconds(error);
  const isRateLimited = statusCode === 429;

  return {
    isRateLimited,
    statusCode,
    retryAfterSeconds,
    userMessage: isRateLimited ? messages.rateLimitedMessage : messages.defaultMessage,
  };
}
