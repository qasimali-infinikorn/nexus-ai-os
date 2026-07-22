import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/db/workspace";
import { getOrganizationById } from "@/lib/db/queries";
import {
  enforceWebhookRateLimit,
  parseOrganizationId,
  resolveWebhookSecret,
  verifyHmacSha256
} from "@/lib/webhooks/auth";
import { githubEventToNotification } from "@/lib/webhooks/github";

export const runtime = "nodejs";

/**
 * GitHub webhook ingest for PR / review / comment events → Reviews/Mentions notifications.
 *
 * URL: `/api/webhooks/github?organizationId=<uuid>`
 * Auth: `X-Hub-Signature-256` with `GITHUB_WEBHOOK_SECRET` (or `WEBHOOK_SECRET`).
 */
export async function POST(req: NextRequest) {
  const secret = resolveWebhookSecret("GITHUB_WEBHOOK_SECRET", "WEBHOOK_SECRET");
  if (!secret) {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET (or WEBHOOK_SECRET) is not configured." },
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

  const { allowed, retryAfterMs } = enforceWebhookRateLimit(req, "github");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyHmacSha256(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    return NextResponse.json({ error: "Unknown organization." }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const event = req.headers.get("x-github-event");
  const draft = githubEventToNotification({ event, payload });
  if (!draft) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const notification = await createNotification({
    organizationId,
    kind: draft.kind,
    title: draft.title,
    body: draft.body,
    href: draft.href.startsWith("http") ? draft.href : "/code-review",
    tone: draft.tone,
    badge: draft.badge,
    prefsEvent: draft.prefsEvent
  });

  return NextResponse.json({ ok: true, notificationId: notification?.id ?? null });
}
