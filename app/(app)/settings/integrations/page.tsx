import { auth } from "@/lib/auth";
import { Avatar, Pill, DemoNotice } from "@/components/workspace/ui";
import { listOrgProviderKeyStatus } from "@/lib/db/queries";
import {
  getGoogleCalendarConnection,
  googleCalendarConfigured
} from "@/lib/integrations/google-calendar";
import {
  getMicrosoftCalendarConnection,
  microsoftCalendarConfigured
} from "@/lib/integrations/microsoft-calendar";
import { GoogleCalendarCard } from "@/components/integrations/google-calendar-card";
import { MicrosoftCalendarCard } from "@/components/integrations/microsoft-calendar-card";
import { OrgKeyRow } from "./org-key-row";
import { integrationCatalog } from "@/lib/workspace/settings-content";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)"
};

export default async function IntegrationsSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ calendar?: string; mscalendar?: string }>;
}) {
  const session = await auth();
  if (!session?.organizationId || !session.user?.id) return null;

  const params = await searchParams;
  const statuses = await listOrgProviderKeyStatus(session.organizationId);
  const canEdit = session.role === "owner" || session.role === "admin";
  const [googleConn, msConn] = await Promise.all([
    getGoogleCalendarConnection(session.user.id, session.organizationId),
    getMicrosoftCalendarConnection(session.user.id, session.organizationId)
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="panel">
        <div className="card-header">
          <div className="card-header-title">
            <h3>AI provider keys</h3>
          </div>
          <span className="badge badge-sky">Shared across your org</span>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <p className="lede" style={{ margin: 0 }}>
            One key per provider, entered once by an admin, encrypted at rest, and shared by every AI feature and
            every member of your org. Nothing is ever sent from a teammate&rsquo;s browser.
          </p>
          {statuses.map((status) => (
            <OrgKeyRow
              key={status.provider}
              provider={status.provider}
              label={PROVIDER_LABELS[status.provider] ?? status.provider}
              configured={status.configured}
              updatedAt={status.updatedAt}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>

      <section className="stack-md">
        <p className="section-label">Calendar</p>
        <div className="grid-3">
          <GoogleCalendarCard
            configured={googleCalendarConfigured()}
            connected={Boolean(googleConn)}
            accountEmail={googleConn?.accountEmail}
            calendarQuery={params.calendar}
          />
          <MicrosoftCalendarCard
            configured={microsoftCalendarConfigured()}
            connected={Boolean(msConn)}
            accountEmail={msConn?.accountEmail}
            calendarQuery={params.mscalendar}
          />
        </div>
      </section>

      <section className="stack-md">
        <p className="section-label">Review webhooks</p>
        <article className="card card-pad stack-md">
          <p className="dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.55, margin: 0 }}>
            Point GitHub or Jira at these URLs (replace the org id). Notifications land in the inbox and
            honor Settings → Notifications for Reviews / Mentions.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            <code className="meta" style={{ display: "block", wordBreak: "break-all" }}>
              /api/webhooks/github?organizationId={session.organizationId}
            </code>
            <code className="meta" style={{ display: "block", wordBreak: "break-all" }}>
              /api/webhooks/jira?organizationId={session.organizationId}
            </code>
          </div>
          <p className="meta" style={{ margin: 0 }}>
            Secrets: <code>GITHUB_WEBHOOK_SECRET</code> / <code>JIRA_WEBHOOK_SECRET</code> (or shared{" "}
            <code>WEBHOOK_SECRET</code>). Optional <code>JIRA_BASE_URL</code> for browse links.
          </p>
        </article>
      </section>

      <section className="stack-md">
        <p className="section-label">Third-party integrations</p>
        <DemoNotice>
          This catalog is a roadmap inventory — nothing here is OAuth-connected. Use AI provider keys, Calendar,
          and Review webhooks above for live integrations. Slack notifications use a personal webhook under
          Settings → Notifications.
        </DemoNotice>
        <div className="grid-3">
          {integrationCatalog.map((i) => (
            <article key={i.id} className="card card-pad stack-md">
              <div className="row" style={{ gap: 12 }}>
                <Avatar initials={i.initials} index={i.avatarIndex} square />
                <div className="stack" style={{ minWidth: 0 }}>
                  <span className="card-title">{i.name}</span>
                  <span className="card-sub">{i.category}</span>
                </div>
              </div>
              <p className="dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
                {i.body}
              </p>
              <div className="row-between" style={{ marginTop: "auto" }}>
                <Pill tone={i.status === "webhook" ? "blue" : "slate"}>
                  {i.status === "webhook" ? "Webhook ingest" : "Coming soon"}
                </Pill>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled
                  title={
                    i.status === "webhook"
                      ? "Configure the webhook URLs in the Review webhooks section above"
                      : "OAuth connect is not implemented yet"
                  }
                >
                  {i.status === "webhook" ? "See webhooks" : "Connect"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
