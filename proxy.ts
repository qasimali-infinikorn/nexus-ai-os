import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// NOTE: this file is intentionally named `proxy.ts`, not `middleware.ts`.
// This repo pins a Next.js version (16.2.10) where the `middleware` file
// convention was renamed to `proxy` — see AGENTS.md and
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// `middleware.ts` is silently ignored on this version.
//
// This performs only optimistic, JWT-derived checks (redirects for UX).
// Every server action and route handler re-verifies authorization itself
// against the database — see lib/db/queries.ts callers in app/api/*.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isPublicApiAuthRoute = pathname.startsWith("/api/auth");
  // Invite links must be reachable while signed out — the page itself
  // decides whether to prompt for login/signup or accept immediately.
  const isInviteRoute = pathname.startsWith("/invite/");
  // Marketing home is public; signed-in users are redirected by the page.
  const isPublicMarketingRoute = pathname === "/";
  // Uptime / load-balancer probes — no session required.
  const isPublicHealthRoute = pathname === "/api/health";
  // External CI/PagerDuty ingest — authenticated via WEBHOOK_SECRET, not session.
  const isPublicWebhookRoute = pathname.startsWith("/api/webhooks/");

  if (
    isPublicApiAuthRoute ||
    isInviteRoute ||
    isPublicMarketingRoute ||
    isPublicHealthRoute ||
    isPublicWebhookRoute
  ) {
    return NextResponse.next();
  }

  if (!session && !isAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Optimistic JWT gate only — layout + requirePlatformAdmin() re-check
  // users.is_platform_admin in the database before rendering or mutating.
  if (pathname.startsWith("/admin") && !session?.user.isPlatformAdmin) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    {
      // Background <Link> prefetches (next-router-prefetch / purpose:
      // prefetch) are excluded — letting proxy's auth() touch/refresh the
      // session cookie on those races them against real user actions like
      // logout: a late-arriving prefetch response's Set-Cookie can
      // resurrect a session-token the logout action just cleared. This is
      // the pattern Next's own proxy docs recommend for exactly this class
      // of issue (node_modules/next/dist/docs/.../file-conventions/proxy.md,
      // "Negative matching").
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};
