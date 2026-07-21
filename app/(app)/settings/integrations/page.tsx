import { auth } from "@/lib/auth";
import { listOrgProviderKeyStatus } from "@/lib/db/queries";
import { OrgKeyRow } from "./org-key-row";

const PROVIDER_LABELS: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic (Claude)", google: "Google (Gemini)" };

export default async function IntegrationsSettingsPage() {
  const session = await auth();
  if (!session?.organizationId) return null;

  const statuses = await listOrgProviderKeyStatus(session.organizationId);
  const canEdit = session.role === "owner" || session.role === "admin";

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

      <div className="panel">
        <div className="card-header">
          <div className="card-header-title">
            <h3>Other integrations</h3>
          </div>
        </div>
        <div className="card-body">
          <p className="lede" style={{ margin: 0 }}>
            GitHub, Jira, Confluence, PagerDuty, Stripe, Google/Microsoft 365 calendars, and SSO are planned for
            later phases — GitHub first (Code Review), then a generic bring-your-own-credentials connector for the
            rest. None are fabricated here; this section will grow as each one lands.
          </p>
        </div>
      </div>
    </div>
  );
}
