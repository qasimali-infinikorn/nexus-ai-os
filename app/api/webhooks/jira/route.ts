import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/db/workspace";
import {
  getOrganizationById,
  getProjectBySlug,
  upsertExternalProjectTask
} from "@/lib/db/queries";
import {
  bearerOrHeaderSecret,
  enforceWebhookRateLimit,
  parseOrganizationId,
  parseProjectSlug,
  resolveWebhookSecret,
  secretsEqual
} from "@/lib/webhooks/auth";
import { jiraEventToNotification } from "@/lib/webhooks/jira";
import { jiraEventToTaskDraft } from "@/lib/webhooks/jira-tasks";

export const runtime = "nodejs";

/**
 * Jira webhook ingest → Reviews / Mentions notifications, and optional
 * one-way Kanban upsert when `projectSlug` is present.
 *
 * URL: `/api/webhooks/jira?organizationId=<uuid>&projectSlug=<slug>`
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
    const draft = jiraEventToTaskDraft(payload);
    if (draft) {
      const task = await upsertExternalProjectTask({
        organizationId,
        projectSlug,
        source: "jira",
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

  const notifDraft = jiraEventToNotification(payload);
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
      href: notifDraft.href,
      tone: notifDraft.tone,
      badge: notifDraft.badge,
      prefsEvent: notifDraft.prefsEvent
    });
    notificationId = notification?.id ?? null;
  }

  return NextResponse.json({ ok: true, notificationId, taskId });
}
