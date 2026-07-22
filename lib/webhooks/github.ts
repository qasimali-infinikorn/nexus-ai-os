export type ReviewNotificationDraft = {
  title: string;
  body: string;
  href: string;
  tone: "violet" | "green" | "amber" | "slate";
  badge: string;
  prefsEvent: "pr_reviews" | "mentions";
  kind: "Reviews" | "Mentions";
};

type GhUser = { login?: string };
type GhRepo = { full_name?: string };
type GhPull = {
  number?: number;
  title?: string;
  html_url?: string;
  user?: GhUser;
  merged?: boolean;
};

/**
 * Map GitHub webhook events to Nexus review notifications.
 * Returns null for events we ignore (pings, noise).
 */
export function githubEventToNotification(params: {
  event: string | null;
  payload: Record<string, unknown>;
}): ReviewNotificationDraft | null {
  const { event, payload } = params;

  if (event === "ping") return null;

  if (event === "pull_request") {
    const action = String(payload.action ?? "");
    const pr = (payload.pull_request ?? {}) as GhPull;
    const repo = (payload.repository ?? {}) as GhRepo;
    const number = pr.number;
    const title = pr.title?.trim() || "Pull request";
    const repoName = repo.full_name ?? "repository";
    const actor = (payload.sender as GhUser | undefined)?.login ?? pr.user?.login ?? "someone";
    const href = pr.html_url || "/code-review";
    const ref = number != null ? `#${number}` : "PR";

    if (action === "review_requested") {
      const reviewer =
        (payload.requested_reviewer as GhUser | undefined)?.login ||
        (payload.requested_team as { slug?: string } | undefined)?.slug ||
        "a reviewer";
      return {
        kind: "Reviews",
        prefsEvent: "pr_reviews",
        title: `${actor} requested review from ${reviewer}`,
        body: `${repoName} ${ref} · ${title}`,
        href,
        tone: "violet",
        badge: "review"
      };
    }

    if (action === "opened" || action === "ready_for_review") {
      return {
        kind: "Reviews",
        prefsEvent: "pr_reviews",
        title: `${actor} opened ${ref}`,
        body: `${repoName} · ${title}`,
        href,
        tone: "violet",
        badge: "opened"
      };
    }

    if (action === "closed") {
      const merged = Boolean(pr.merged);
      return {
        kind: "Reviews",
        prefsEvent: "pr_reviews",
        title: merged ? `${actor} merged ${ref}` : `${actor} closed ${ref}`,
        body: `${repoName} · ${title}`,
        href,
        tone: merged ? "green" : "slate",
        badge: merged ? "merged" : "closed"
      };
    }

    return null;
  }

  if (event === "pull_request_review") {
    const action = String(payload.action ?? "");
    if (action !== "submitted") return null;
    const review = (payload.review ?? {}) as { state?: string; user?: GhUser; html_url?: string };
    const pr = (payload.pull_request ?? {}) as GhPull;
    const repo = (payload.repository ?? {}) as GhRepo;
    const state = (review.state ?? "").toLowerCase();
    const actor = review.user?.login ?? "someone";
    const number = pr.number;
    const ref = number != null ? `#${number}` : "PR";
    const title = pr.title?.trim() || "Pull request";
    const href = review.html_url || pr.html_url || "/code-review";

    let label = "reviewed";
    let tone: ReviewNotificationDraft["tone"] = "violet";
    let badge = "reviewed";
    if (state === "approved") {
      label = "approved";
      tone = "green";
      badge = "approved";
    } else if (state === "changes_requested") {
      label = "requested changes on";
      tone = "amber";
      badge = "changes";
    }

    return {
      kind: "Reviews",
      prefsEvent: "pr_reviews",
      title: `${actor} ${label} ${ref}`,
      body: `${repo.full_name ?? "repository"} · ${title}`,
      href,
      tone,
      badge
    };
  }

  if (event === "issue_comment" || event === "pull_request_review_comment") {
    const action = String(payload.action ?? "");
    if (action !== "created") return null;
    const comment = (payload.comment ?? {}) as { user?: GhUser; body?: string; html_url?: string };
    const pr = (payload.pull_request ?? payload.issue ?? {}) as GhPull & { title?: string; html_url?: string };
    const actor = comment.user?.login ?? "someone";
    const snippet = (comment.body ?? "").trim().slice(0, 140);
    const number = pr.number;
    const ref = number != null ? `#${number}` : "thread";
    return {
      kind: "Mentions",
      prefsEvent: "mentions",
      title: `${actor} commented on ${ref}`,
      body: snippet || (pr.title ?? "New comment"),
      href: comment.html_url || pr.html_url || "/code-review",
      tone: "slate",
      badge: "comment"
    };
  }

  return null;
}
