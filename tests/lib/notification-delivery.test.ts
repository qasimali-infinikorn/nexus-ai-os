import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  absoluteHref,
  appBaseUrl,
  deliverExternalChannels,
  emailConfigured,
  sendNotificationEmail,
  sendSlackWebhook
} from "@/lib/notifications/deliver";

describe("notification delivery", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.APP_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports email configured only with key + from", () => {
    expect(emailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "re_test";
    expect(emailConfigured()).toBe(false);
    process.env.EMAIL_FROM = "Nexus <notify@example.com>";
    expect(emailConfigured()).toBe(true);
  });

  it("builds absolute links from APP_URL", () => {
    process.env.APP_URL = "https://app.example/";
    expect(appBaseUrl()).toBe("https://app.example");
    expect(absoluteHref("/notifications")).toBe("https://app.example/notifications");
  });

  it("sends email via Resend when configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Nexus <notify@example.com>";
    process.env.APP_URL = "https://app.example";
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => ""
    });

    const result = await sendNotificationEmail({
      to: "user@example.com",
      payload: { title: "Hi", body: "Body", href: "/agents", kind: "Agents" }
    });
    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test" })
      })
    );
  });

  it("skips email when not configured", async () => {
    const result = await sendNotificationEmail({
      to: "user@example.com",
      payload: { title: "Hi", body: "Body", href: "/agents", kind: "Agents" }
    });
    expect(result.skipped).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends invitation emails with org context via Resend", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Nexus <notify@example.com>";
    process.env.APP_URL = "https://app.example";
    const { sendInvitationEmail } = await import("@/lib/notifications/deliver");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => ""
    });

    const result = await sendInvitationEmail({
      to: "new@example.com",
      organizationName: "Acme",
      role: "member",
      invitePath: "/invite/tok_abc",
      invitedByName: "Alex"
    });
    expect(result).toEqual({ ok: true });
    const body = JSON.parse(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    );
    expect(body.to).toEqual(["new@example.com"]);
    expect(body.subject).toContain("Acme");
    expect(body.text).toContain("Alex invited you");
    expect(body.text).toContain("https://app.example/invite/tok_abc");
  });

  it("sends password reset emails via Resend", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Nexus <notify@example.com>";
    process.env.APP_URL = "https://app.example";
    const { sendPasswordResetEmail } = await import("@/lib/notifications/deliver");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => ""
    });

    const result = await sendPasswordResetEmail({
      to: "user@example.com",
      resetPath: "/reset-password/tok_xyz"
    });
    expect(result).toEqual({ ok: true });
    const body = JSON.parse(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    );
    expect(body.subject).toContain("Reset");
    expect(body.text).toContain("https://app.example/reset-password/tok_xyz");
  });

  it("posts to Slack incoming webhooks only", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const bad = await sendSlackWebhook({
      webhookUrl: "https://evil.example/hook",
      payload: { title: "T", body: "B", href: "/x", kind: "Mentions" }
    });
    expect(bad.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();

    const ok = await sendSlackWebhook({
      webhookUrl: "https://hooks.slack.com/services/T/B/X",
      payload: { title: "T", body: "B", href: "/x", kind: "Mentions" }
    });
    expect(ok.ok).toBe(true);
    expect(fetch).toHaveBeenCalled();
  });

  it("delivers only enabled channels", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Nexus <notify@example.com>";
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, text: async () => "" });

    await deliverExternalChannels({
      channels: { inApp: true, email: true, slack: false },
      email: "a@example.com",
      slackWebhookUrl: "https://hooks.slack.com/services/T/B/X",
      payload: { title: "T", body: "B", href: "/n", kind: "Mentions" }
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "https://api.resend.com/emails"
    );
  });
});
