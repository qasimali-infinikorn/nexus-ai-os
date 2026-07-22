import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/db/workspace";
import { getOrganizationById } from "@/lib/db/queries";
import {
  bearerOrHeaderSecret,
  enforceWebhookRateLimit,
  parseOrganizationId,
  resolveWebhookSecret,
  secretsEqual
} from "@/lib/webhooks/auth";
import { jiraEventToNotification } from "@/lib/webhooks/jira";

export const runtime = "nodejs";

/**
 * Jira webhook ingest → Reviews / Mentions notifications.
 *
 * URL: `/api/webhooks/jira?organizationId=<uuid>`
 * Auth: `Authorization: Bearer …` or `x-nexus-webhook-secret` using
 * `JIRA_WEBHOOK_SECRET` (or `WEBHOOK_SECRET`).
 */
export async function POST(req: NextRequest) {
  const secret = resolveWebhookSecret("JIRA_WEBHOOK_SECRET", "WEBHOOK_SECRET");
  if (!secret) {
    return NextResponse.json(
      { error: "JIRA_WEBHOOK_SECRET (or WEBHOOK_SECRET) is not configured." },
      { status: 503 }
    );
  }

  const organizationId = parseOrganizationId(req);
  if (!organizationId) {
    return NextResponse.json(
      { error: "organizationId query param (uuid) is required." },
      { status: 400 }
    );
  }

  const provided = bearerOrHeaderSecret(req);
  if (!provided || !secretsEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { allowed, retryAfterMs } = enforceWebhookRateLimit(req, "jira");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    );
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    return NextResponse.json({ error: "Unknown organization." }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const draft = jiraEventToNotification(payload);
  if (!draft) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const notification = await createNotification({
    organizationId,
    kind: draft.kind,
    title: draft.title,
    body: draft.body,
    href: draft.href,
    tone: draft.tone,
    badge: draft.badge,
    prefsEvent: draft.prefsEvent
  });

  return NextResponse.json({ ok: true, notificationId: notification?.id ?? null });
}
