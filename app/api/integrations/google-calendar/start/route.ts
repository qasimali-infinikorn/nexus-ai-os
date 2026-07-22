import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildGoogleCalendarAuthUrl, googleCalendarConfigured } from "@/lib/integrations/google-calendar";
import { signGoogleOAuthState } from "@/lib/integrations/google-oauth-state";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Start Google Calendar OAuth (separate from Auth.js login). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { allowed } = rateLimit(`gcal-oauth:${session.user.id}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many OAuth attempts." }, { status: 429 });
  }

  if (!googleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/settings/integrations?calendar=not_configured", req.url));
  }

  const state = signGoogleOAuthState({
    u: session.user.id,
    o: session.organizationId,
    e: Date.now() + 10 * 60 * 1000
  });
  const url = buildGoogleCalendarAuthUrl({ origin: req.nextUrl.origin, state });
  return NextResponse.redirect(url);
}
