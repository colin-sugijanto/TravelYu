function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  if (!isObject(error)) return null;

  const direct = getNumber(error.statusCode);
  if (direct !== null) return direct;

  if (isObject(error.cause)) {
    const causeStatus = getNumber(error.cause.statusCode) ?? getNumber(error.cause.status);
    if (causeStatus !== null) return causeStatus;
  }

  const message = getString(error.message)?.toLowerCase() ?? "";
  if (message.includes("429") || message.includes("too many requests") || message.includes("rate limit")) {
    return 429;
  }

  return null;
}

function inferRetryAfterSeconds(error: unknown): number | null {
  const headers = getHeaderRecord(error);

  const retryAfterValue = headers["retry-after"];
  if (!retryAfterValue) return null;

  const parsed = Number.parseInt(retryAfterValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;

  return parsed;
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
