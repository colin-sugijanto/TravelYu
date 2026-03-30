import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/destinations(.*)",
  "/activities(.*)",
  "/trip/s/(.*)",
  "/memory/s/(.*)",
  "/api/notifications/trip-event",
  "/manifest.json",
  "/favicon.ico",
  "/logo.png",
  "/globe.svg",
  "/file.svg",
  "/next.svg",
  "/vercel.svg",
  "/window.svg",
]);

// Named export for Next.js 16+ compatibility (avoids deprecation warning)
export const middleware = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    const pathname = request.nextUrl.pathname;
    const search = request.nextUrl.search;
    const loginUrl = new URL(`/login?next=${encodeURIComponent(pathname + search)}`, request.url);

    await auth.protect({
      unauthenticatedUrl: loginUrl.toString(),
    });
  }
});

export const config = {
  matcher: [
    // Protect everything except Next.js internals and specified public paths
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
