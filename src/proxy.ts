import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/trip/new(.*)",
  "/profile(.*)",
  "/referral(.*)",
  "/admin(.*)",
  "/trip/([^/]+)/(packing|budget|memory|review)(.*)",
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;

  if (isProtectedRoute(request)) {
    const nextPath = `${pathname}${request.nextUrl.search}`;
    const loginUrl = new URL(`/login?next=${encodeURIComponent(nextPath)}`, request.url);

    await auth.protect({
      unauthenticatedUrl: loginUrl.toString(),
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
