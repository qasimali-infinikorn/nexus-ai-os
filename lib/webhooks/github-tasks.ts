import type { TaskKind, TaskPriority, TaskStatus } from "@/lib/db/schema";
import type { ExternalTaskDraft } from "@/lib/webhooks/jira-tasks";

function mapGithubIssueState(state: string | undefined, labels: string[]): TaskStatus {
  if ((state ?? "").toLowerCase() === "closed") return "Done";
  const labelText = labels.join(" ").toLowerCase();
  if (/(in review|review|qa)/.test(labelText)) return "In Review";
  if (/(in progress|wip|doing)/.test(labelText)) return "In Progress";
  return "To Do";
}

function mapGithubKind(labels: string[]): TaskKind {
  const text = labels.join(" ").toLowerCase();
  if (text.includes("bug")) return "bug";
  if (text.includes("story") || text.includes("feature")) return "story";
  return "task";
}

function mapGithubPriority(labels: string[]): TaskPriority {
  const text = labels.join(" ").toLowerCase();
  if (/(critical|p0|blocker)/.test(text)) return "Critical";
  if (/(high|p1)/.test(text)) return "High";
  if (/(low|p3)/.test(text)) return "Low";
  return "Med";
}

function mapPullRequestStatus(
  state: string | undefined,
  merged: boolean | undefined,
  draft: boolean | undefined
): TaskStatus {
  if (merged || (state ?? "").toLowerCase() === "closed") return "Done";
  if (draft) return "To Do";
  return "In Review";
}

/**
 * Map GitHub Issues / Pull Request webhook events to a Kanban upsert draft.
 * Issue comments are ignored (notifications handle those).
 */
export function githubEventToTaskDraft(params: {
  event: string | null;
  payload: Record<string, unknown>;
}): ExternalTaskDraft | null {
  const { event, payload } = params;

  if (event === "pull_request") {
    return githubPullRequestToTaskDraft(payload);
  }

  if (event !== "issues") return null;

  const action = String(payload.action ?? "");
  if (!["opened", "edited", "reopened", "closed", "labeled", "unlabeled", "assigned"].includes(action)) {
    return null;
  }

  // Skip PRs masquerading as issues — handled via pull_request events.
  if (payload.pull_request) return null;

  const issue = (payload.issue ?? {}) as {
    number?: number;
    title?: string;
    body?: string | null;
    state?: string;
    html_url?: string;
    labels?: { name?: string }[];
  };
  const repo = (payload.repository ?? {}) as { full_name?: string };
  const number = issue.number;
  const repoName = repo.full_name?.trim();
  if (!number || !repoName) return null;

  const labels = (issue.labels ?? []).map((l) => l.name ?? "").filter(Boolean);
  const externalId = `github:${repoName}#${number}`;
  const shortRepo = repoName.split("/")[1] || repoName;
  const preferredRef = `${shortRepo.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, "") || "GH"}-${number}`;

  return {
    externalId,
    preferredRef,
    title: (issue.title ?? `Issue #${number}`).trim().slice(0, 200),
    description: issue.body?.slice(0, 5000) ?? null,
    status: mapGithubIssueState(issue.state, labels),
    kind: mapGithubKind(labels),
    priority: mapGithubPriority(labels),
    externalUrl: issue.html_url ?? null
  };
}

function githubPullRequestToTaskDraft(payload: Record<string, unknown>): ExternalTaskDraft | null {
  const action = String(payload.action ?? "");
  if (
    ![
      "opened",
      "edited",
      "reopened",
      "closed",
      "converted_to_draft",
      "ready_for_review",
      "synchronize",
      "labeled",
      "unlabeled"
    ].includes(action)
  ) {
    return null;
  }

  const pr = (payload.pull_request ?? {}) as {
    number?: number;
    title?: string;
    body?: string | null;
    state?: string;
    html_url?: string;
    draft?: boolean;
    merged?: boolean;
    labels?: { name?: string }[];
  };
  const repo = (payload.repository ?? {}) as { full_name?: string };
  const number = pr.number;
  const repoName = repo.full_name?.trim();
  if (!number || !repoName) return null;

  const labels = (pr.labels ?? []).map((l) => l.name ?? "").filter(Boolean);
  const externalId = `github:${repoName}#pr-${number}`;
  const shortRepo = repoName.split("/")[1] || repoName;
  const preferredRef = `${shortRepo.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "") || "GH"}-PR-${number}`;

  return {
    externalId,
    preferredRef,
    title: (pr.title ?? `PR #${number}`).trim().slice(0, 200),
    description: pr.body?.slice(0, 5000) ?? null,
    status: mapPullRequestStatus(pr.state, pr.merged, pr.draft),
    kind: "task",
    priority: mapGithubPriority(labels),
    externalUrl: pr.html_url ?? null
  };
}
