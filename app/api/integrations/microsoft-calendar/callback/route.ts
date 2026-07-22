import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  exchangeMicrosoftCode,
  upsertMicrosoftCalendarConnection,
  syncMicrosoftCalendarMeetings
} from "@/lib/integrations/microsoft-calendar";
import { verifyGoogleOAuthState } from "@/lib/integrations/google-oauth-state";
import { writeAuditLog } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(new URL(`/settings/integrations?mscalendar=denied`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(`/settings/integrations?mscalendar=error`, req.url));
  }

  const payload = verifyGoogleOAuthState(state);
  if (!payload || payload.u !== session.user.id || payload.o !== session.organizationId) {
    return NextResponse.redirect(new URL(`/settings/integrations?mscalendar=invalid_state`, req.url));
  }

  try {
    const tokens = await exchangeMicrosoftCode({ code, origin: req.nextUrl.origin });
    await upsertMicrosoftCalendarConnection({
      userId: session.user.id,
      organizationId: session.organizationId,
      refreshToken: tokens.refreshToken,
      accountEmail: tokens.email
    });
    await writeAuditLog({
      organizationId: session.organizationId,
      actorUserId: session.user.id,
      action: "integration.microsoft_calendar.connect",
      targetType: "oauth_connection",
      targetId: "microsoft_calendar",
      metadata: { email: tokens.email ?? null }
    });
    await syncMicrosoftCalendarMeetings({
      userId: session.user.id,
      organizationId: session.organizationId
    });
    return NextResponse.redirect(new URL("/meetings?calendar=synced", req.url));
  } catch {
    return NextResponse.redirect(new URL("/settings/integrations?mscalendar=error", req.url));
  }
}
