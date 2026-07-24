import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/db/workspace";
import {
  getOrganizationById,
  getProjectBySlug,
  upsertExternalProjectTask
} from "@/lib/db/queries";
import {
  enforceWebhookRateLimit,
  parseOrganizationId,
  parseProjectSlug,
  resolveWebhookSecret,
  verifyHmacSha256
} from "@/lib/webhooks/auth";
import { githubEventToNotification } from "@/lib/webhooks/github";
import { githubEventToTaskDraft } from "@/lib/webhooks/github-tasks";

export const runtime = "nodejs";

/**
 * GitHub webhook ingest → Reviews/Mentions notifications, and optional
 * one-way Kanban upsert for Issues **and Pull Requests** when `projectSlug` is present.
 *
 * URL: `/api/webhooks/github?organizationId=<uuid>&projectSlug=<slug>`
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

  const projectSlug = parseProjectSlug(req);
  let taskId: string | null = null;
  if (projectSlug) {
    const project = await getProjectBySlug(organizationId, projectSlug);
    if (!project) {
      return NextResponse.json(
        { error: `Unknown projectSlug "${projectSlug}" for this organization.` },
        { status: 404 }
      );
    }
    const draft = githubEventToTaskDraft({ event, payload });
    if (draft) {
      const task = await upsertExternalProjectTask({
        organizationId,
        projectSlug,
        source: "github",
        externalId: draft.externalId,
        externalUrl: draft.externalUrl,
        title: draft.title,
        description: draft.description,
        status: draft.status,
        kind: draft.kind,
        priority: draft.priority,
        preferredRef: draft.preferredRef
      });
      taskId = task.id;
    }
  }

  const notifDraft = githubEventToNotification({ event, payload });
  if (!notifDraft && !taskId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let notificationId: string | null = null;
  if (notifDraft) {
    const notification = await createNotification({
      organizationId,
      kind: notifDraft.kind,
      title: notifDraft.title,
      body: notifDraft.body,
      href: notifDraft.href.startsWith("http") ? notifDraft.href : "/code-review",
      tone: notifDraft.tone,
      badge: notifDraft.badge,
      prefsEvent: notifDraft.prefsEvent
    });
    notificationId = notification?.id ?? null;
  }

  return NextResponse.json({ ok: true, notificationId, taskId });
}
