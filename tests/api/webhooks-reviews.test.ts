import { createHmac } from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetRateLimiterForTests } from "@/lib/rate-limit";
import { githubEventToNotification } from "@/lib/webhooks/github";
import { jiraEventToNotification } from "@/lib/webhooks/jira";
import { verifyHmacSha256 } from "@/lib/webhooks/auth";

vi.mock("@/lib/db/workspace", () => ({
  createNotification: vi.fn(async () => ({ id: "n-review-1" }))
}));

vi.mock("@/lib/db/queries", () => ({
  getOrganizationById: vi.fn(async (id: string) =>
    id === "00000000-0000-4000-8000-000000000001" ? { id, name: "Acme" } : undefined
  )
}));

describe("githubEventToNotification", () => {
  it("maps review_requested and approvals", () => {
    const requested = githubEventToNotification({
      event: "pull_request",
      payload: {
        action: "review_requested",
        sender: { login: "priya" },
        requested_reviewer: { login: "alex" },
        pull_request: { number: 482, title: "Idempotency keys", html_url: "https://gh/pr/482" },
        repository: { full_name: "acme/payments" }
      }
    });
    expect(requested?.title).toContain("requested review");
    expect(requested?.prefsEvent).toBe("pr_reviews");

    const approved = githubEventToNotification({
      event: "pull_request_review",
      payload: {
        action: "submitted",
        review: { state: "approved", user: { login: "dana" }, html_url: "https://gh/r/1" },
        pull_request: { number: 482, title: "Idempotency keys" },
        repository: { full_name: "acme/payments" }
      }
    });
    expect(approved?.badge).toBe("approved");
    expect(approved?.tone).toBe("green");
  });

  it("ignores ping", () => {
    expect(githubEventToNotification({ event: "ping", payload: {} })).toBeNull();
  });
});

describe("jiraEventToNotification", () => {
  it("maps comments and issue updates", () => {
    const comment = jiraEventToNotification({
      webhookEvent: "comment_created",
      user: { displayName: "Sam" },
      comment: { body: "Please take a look" },
      issue: { key: "NX-12", fields: { summary: "Fix webhook auth" } }
    });
    expect(comment?.kind).toBe("Mentions");
    expect(comment?.title).toContain("NX-12");

    const updated = jiraEventToNotification({
      webhookEvent: "jira:issue_updated",
      user: { displayName: "Sam" },
      issue: { key: "NX-12", fields: { summary: "Fix webhook auth", status: { name: "In Progress" } } },
      changelog: { items: [{ field: "status", toString: "In Progress" }] }
    });
    expect(updated?.kind).toBe("Reviews");
    expect(updated?.body).toContain("In Progress");
  });
});

describe("verifyHmacSha256", () => {
  it("accepts a valid GitHub signature", () => {
    const body = '{"zen":"ok"}';
    const secret = "github-secret";
    const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyHmacSha256(body, sig, secret)).toBe(true);
    expect(verifyHmacSha256(body, sig, "other")).toBe(false);
  });
});

describe("POST /api/webhooks/github", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    resetRateLimiterForTests();
    vi.resetModules();
    process.env.GITHUB_WEBHOOK_SECRET = "github-secret";
  });

  it("creates a Reviews notification for review_requested", async () => {
    const { POST } = await import("@/app/api/webhooks/github/route");
    const { createNotification } = await import("@/lib/db/workspace");
    const body = JSON.stringify({
      action: "review_requested",
      sender: { login: "priya" },
      requested_reviewer: { login: "alex" },
      pull_request: { number: 1, title: "Test", html_url: "https://example.com/1" },
      repository: { full_name: "acme/app" }
    });
    const sig = `sha256=${createHmac("sha256", "github-secret").update(body).digest("hex")}`;
    const req = new Request(`http://localhost/api/webhooks/github?organizationId=${orgId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sig,
        "x-github-event": "pull_request"
      },
      body
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "Reviews", prefsEvent: "pr_reviews" })
    );
  });

  it("rejects bad signatures", async () => {
    const { POST } = await import("@/app/api/webhooks/github/route");
    const req = new Request(`http://localhost/api/webhooks/github?organizationId=${orgId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=deadbeef",
        "x-github-event": "ping"
      },
      body: "{}"
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/webhooks/jira", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    resetRateLimiterForTests();
    vi.resetModules();
    process.env.JIRA_WEBHOOK_SECRET = "jira-secret";
  });

  it("creates a Mentions notification for comments", async () => {
    const { POST } = await import("@/app/api/webhooks/jira/route");
    const { createNotification } = await import("@/lib/db/workspace");
    const req = new Request(`http://localhost/api/webhooks/jira?organizationId=${orgId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer jira-secret"
      },
      body: JSON.stringify({
        webhookEvent: "comment_created",
        user: { displayName: "Sam" },
        comment: { body: "Looks good" },
        issue: { key: "NX-9", fields: { summary: "Ship webhooks" } }
      })
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "Mentions", prefsEvent: "mentions" })
    );
  });
});
