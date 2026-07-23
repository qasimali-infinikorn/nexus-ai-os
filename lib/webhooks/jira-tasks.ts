import type { TaskKind, TaskPriority, TaskStatus } from "@/lib/db/schema";

export type ExternalTaskDraft = {
  externalId: string;
  preferredRef: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  kind: TaskKind;
  priority: TaskPriority;
  externalUrl?: string | null;
};

function mapJiraStatus(name: string | undefined): TaskStatus {
  const n = (name ?? "").toLowerCase();
  if (!n) return "To Do";
  if (/(done|closed|resolved|complete|shipped)/.test(n)) return "Done";
  if (/(review|qa|testing|verify)/.test(n)) return "In Review";
  if (/(progress|doing|dev|active|started)/.test(n)) return "In Progress";
  return "To Do";
}

function mapJiraPriority(name: string | undefined): TaskPriority {
  const n = (name ?? "").toLowerCase();
  if (n.includes("highest") || n.includes("critical") || n.includes("blocker")) return "Critical";
  if (n.includes("high")) return "High";
  if (n.includes("low") || n.includes("lowest") || n.includes("trivial")) return "Low";
  return "Med";
}

function mapJiraKind(issueType: string | undefined): TaskKind {
  const n = (issueType ?? "").toLowerCase();
  if (n.includes("bug")) return "bug";
  if (n.includes("story") || n.includes("epic")) return "story";
  return "task";
}

/**
 * Map Jira issue create/update webhooks to a Kanban upsert draft.
 * Comments are ignored (notifications handle those).
 */
export function jiraEventToTaskDraft(payload: Record<string, unknown>): ExternalTaskDraft | null {
  const webhookEvent = String(payload.webhookEvent ?? "");
  if (webhookEvent === "comment_created" || payload.comment) return null;
  if (
    webhookEvent &&
    !webhookEvent.startsWith("jira:issue_") &&
    webhookEvent !== "jira:issue_created" &&
    webhookEvent !== "jira:issue_updated"
  ) {
    return null;
  }

  const issue = (payload.issue ?? {}) as {
    key?: string;
    fields?: {
      summary?: string;
      description?: string | { content?: unknown };
      status?: { name?: string };
      priority?: { name?: string };
      issuetype?: { name?: string };
    };
  };
  const key = issue.key?.trim();
  if (!key) return null;

  const fields = issue.fields ?? {};
  const summary = fields.summary?.trim() || key;
  let description: string | null = null;
  if (typeof fields.description === "string") {
    description = fields.description.slice(0, 5000);
  }

  const baseUrl = process.env.JIRA_BASE_URL?.trim()?.replace(/\/$/, "");
  const externalUrl = baseUrl ? `${baseUrl}/browse/${key}` : null;

  // Prefer changelog status on updates when present.
  const changelog = payload.changelog as
    | { items?: { field?: string; toString?: string }[] }
    | undefined;
  const statusChange = changelog?.items?.find((i) => i.field === "status");
  const statusName = statusChange?.toString || fields.status?.name;

  return {
    externalId: `jira:${key}`,
    preferredRef: key,
    title: summary.slice(0, 200),
    description,
    status: mapJiraStatus(statusName),
    kind: mapJiraKind(fields.issuetype?.name),
    priority: mapJiraPriority(fields.priority?.name),
    externalUrl
  };
}

export function mapJiraStatusForTests(name: string): TaskStatus {
  return mapJiraStatus(name);
}
