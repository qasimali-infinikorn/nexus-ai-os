/**
 * External notification delivery (email via Resend, Slack via incoming webhook).
 * Never throws to callers — failures are swallowed so inbox writes still succeed.
 */

export type DeliveryPayload = {
  title: string;
  body: string;
  href: string;
  kind: string;
};

export type ChannelPrefs = { inApp: boolean; email: boolean; slack: boolean };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export function appBaseUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function absoluteHref(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  const path = href.startsWith("/") ? href : `/${href}`;
  return `${appBaseUrl()}${path}`;
}

export async function sendNotificationEmail(params: {
  to: string;
  payload: DeliveryPayload;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return { ok: true, skipped: true };

  const link = absoluteHref(params.payload.href);
  const subject = `[Nexus] ${params.payload.title}`;
  const text = `${params.payload.body}\n\nOpen: ${link}\n`;
  const html = `<p>${escapeHtml(params.payload.body)}</p><p><a href="${escapeHtml(link)}">Open in Nexus</a></p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject,
        text,
        html
      })
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, error: `Resend ${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}

/** Workspace invite — uses the same Resend credentials as notification mail. */
export async function sendInvitationEmail(params: {
  to: string;
  organizationName: string;
  role: string;
  invitePath: string;
  invitedByName?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const inviter = params.invitedByName?.trim();
  const role = params.role;
  const org = params.organizationName;
  const body = inviter
    ? `${inviter} invited you to join ${org} on Nexus as ${role}. The link expires in 7 days.`
    : `You've been invited to join ${org} on Nexus as ${role}. The link expires in 7 days.`;

  return sendNotificationEmail({
    to: params.to,
    payload: {
      title: `Join ${org}`,
      body,
      href: params.invitePath.startsWith("/") ? params.invitePath : `/${params.invitePath}`,
      kind: "Invite"
    }
  });
}

export async function sendSlackWebhook(params: {
  webhookUrl: string;
  payload: DeliveryPayload;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const url = params.webhookUrl.trim();
  if (!url.startsWith("https://hooks.slack.com/")) {
    return { ok: false, error: "Invalid Slack webhook URL." };
  }

  const link = absoluteHref(params.payload.href);
  const text = `*${params.payload.title}*\n${params.payload.body}\n<${link}|Open in Nexus>`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      return { ok: false, error: `Slack ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Slack send failed." };
  }
}

export async function deliverExternalChannels(params: {
  channels: ChannelPrefs;
  email?: string | null;
  slackWebhookUrl?: string | null;
  payload: DeliveryPayload;
}): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  if (params.channels.email && params.email) {
    jobs.push(sendNotificationEmail({ to: params.email, payload: params.payload }));
  }
  if (params.channels.slack && params.slackWebhookUrl) {
    jobs.push(sendSlackWebhook({ webhookUrl: params.slackWebhookUrl, payload: params.payload }));
  }
  if (jobs.length === 0) return;
  await Promise.allSettled(jobs);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
