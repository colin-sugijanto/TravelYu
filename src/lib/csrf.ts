import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
].filter(Boolean) as string[];

function getOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function verifyCsrfHeaders(request: NextRequest): { valid: true } | { valid: false; reason: string } {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  const originOrigin = getOrigin(origin);
  const refererOrigin = getOrigin(referer);

  const checkOrigin = originOrigin || refererOrigin;

  if (!checkOrigin) {
    if (process.env.NODE_ENV === "production") {
      return { valid: false, reason: "Missing Origin and Referer headers" };
    }
    return { valid: true };
  }

  const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
    const allowedOrigin = getOrigin(allowed);
    return allowedOrigin === checkOrigin || allowedOrigin === null;
  });

  if (!isAllowed) {
    return { valid: false, reason: `Origin ${checkOrigin} not allowed` };
  }

  return { valid: true };
}

export function createCsrfErrorResponse(reason: string) {
  return NextResponse.json(
    { error: "CSRF validation failed", reason },
    { status: 403 },
  );
}
