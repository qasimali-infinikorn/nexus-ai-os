import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildMicrosoftCalendarAuthUrl,
  microsoftCalendarConfigured
} from "@/lib/integrations/microsoft-calendar";
import { signGoogleOAuthState } from "@/lib/integrations/google-oauth-state";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Start Microsoft Calendar OAuth (separate from Auth.js login). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { allowed } = rateLimit(`mscal-oauth:${session.user.id}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many OAuth attempts." }, { status: 429 });
  }

  if (!microsoftCalendarConfigured()) {
    return NextResponse.redirect(new URL("/settings/integrations?mscalendar=not_configured", req.url));
  }

  const state = signGoogleOAuthState({
    u: session.user.id,
    o: session.organizationId,
    e: Date.now() + 10 * 60 * 1000
  });
  const url = buildMicrosoftCalendarAuthUrl({ origin: req.nextUrl.origin, state });
  return NextResponse.redirect(url);
}
