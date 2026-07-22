import type { ReviewNotificationDraft } from "@/lib/webhooks/github";

/**
 * Map Atlassian Jira webhook payloads to Nexus notifications.
 * Configure the Jira webhook URL with ?organizationId=<uuid>.
 */
export function jiraEventToNotification(payload: Record<string, unknown>): ReviewNotificationDraft | null {
  const webhookEvent = String(payload.webhookEvent ?? "");
  const issue = (payload.issue ?? {}) as {
    key?: string;
    fields?: { summary?: string; status?: { name?: string } };
    self?: string;
  };
  const key = issue.key?.trim();
  if (!key) return null;

  const summary = issue.fields?.summary?.trim() || key;
  const user =
    (payload.user as { displayName?: string } | undefined)?.displayName ||
    (payload.comment as { author?: { displayName?: string } } | undefined)?.author?.displayName ||
    "Someone";

  const baseUrl = process.env.JIRA_BASE_URL?.trim()?.replace(/\/$/, "");
  const href = baseUrl ? `${baseUrl}/browse/${key}` : "/projects";

  if (webhookEvent === "comment_created" || payload.comment) {
    const comment = (payload.comment ?? {}) as { body?: string };
    const body = (comment.body ?? "").trim().slice(0, 160) || `Comment on ${key}`;
    return {
      kind: "Mentions",
      prefsEvent: "mentions",
      title: `${user} commented on ${key}`,
      body: `${summary} — ${body}`,
      href,
      tone: "slate",
      badge: "jira"
    };
  }

  if (
    webhookEvent === "jira:issue_updated" ||
    webhookEvent === "jira:issue_created" ||
    webhookEvent.startsWith("jira:issue_")
  ) {
    const status = issue.fields?.status?.name;
    const changelog = payload.changelog as
      | { items?: { field?: string; toString?: string }[] }
      | undefined;
    const statusChange = changelog?.items?.find((i) => i.field === "status");
    const detail = statusChange?.toString
      ? `Status → ${statusChange.toString}`
      : status
        ? `Status: ${status}`
        : "Issue updated";

    return {
      kind: "Reviews",
      prefsEvent: "pr_reviews",
      title: `${user} updated ${key}`,
      body: `${summary} · ${detail}`,
      href,
      tone: "violet",
      badge: "jira"
    };
  }

  return null;
}
