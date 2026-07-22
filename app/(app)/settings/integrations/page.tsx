import { auth } from "@/lib/auth";
import { Avatar, Pill, DemoNotice } from "@/components/workspace/ui";
import { listOrgProviderKeyStatus } from "@/lib/db/queries";
import { OrgKeyRow } from "./org-key-row";
import { integrationCatalog } from "@/lib/workspace/settings-content";

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

      <section className="stack-md">
        <p className="section-label">Third-party integrations</p>
        <DemoNotice>
          Connection states below are demo content — no OAuth apps are registered yet. GitHub lands first, then a
          generic bring-your-own-credentials connector for the rest.
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
                <Pill tone={i.connected ? "green" : "slate"}>{i.connected ? "Connected" : "Not connected"}</Pill>
                <button type="button" className="btn-secondary btn-sm" disabled>
                  {i.connected ? "Manage" : "Connect"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
