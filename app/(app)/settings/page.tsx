import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listOrgApiKeys } from "@/lib/db/api-keys";
import { getUserById, getUserSettings, listOrgProviderKeyStatus } from "@/lib/db/queries";
import { getAgentRunStats, listAgentRuns } from "@/lib/db/workspace";
import {
  getGoogleCalendarConnection,
  googleCalendarConfigured
} from "@/lib/integrations/google-calendar";
import {
  getMicrosoftCalendarConnection,
  microsoftCalendarConfigured
} from "@/lib/integrations/microsoft-calendar";
import { Card, CardHead, Pill, Avatar } from "@/components/workspace/ui";
import { formatRelativeTime } from "@/lib/workspace/admin-ui";
import type { Tone } from "@/lib/workspace/content";
import { ProfileForm } from "./profile-form";
import { ApiKeysPanel } from "./api-keys-panel";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

type ServiceRow = {
  id: string;
  name: string;
  detail: string;
  initials: string;
  avatarIndex: number;
  state: string;
  tone: Tone;
  href: string;
};

const PROVIDER_META: Record<string, { name: string; initials: string; avatarIndex: number }> = {
  openai: { name: "OpenAI", initials: "OA", avatarIndex: 0 },
  anthropic: { name: "Anthropic", initials: "AN", avatarIndex: 1 },
  google: { name: "Google Gemini", initials: "GG", avatarIndex: 2 }
};

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) return null;

  const canManageKeys = session.role === "owner" || session.role === "admin";

  const [stats, recentRuns, keyStatuses, settings, googleConn, msConn, apiKeys] = await Promise.all([
    getAgentRunStats(session.organizationId),
    listAgentRuns(session.organizationId, 5),
    listOrgProviderKeyStatus(session.organizationId),
    getUserSettings(session.user.id, session.organizationId),
    getGoogleCalendarConnection(session.user.id, session.organizationId),
    getMicrosoftCalendarConnection(session.user.id, session.organizationId),
    listOrgApiKeys(session.organizationId)
  ]);

  const finished = stats.succeeded + stats.failed;
  const successRate =
    finished > 0 ? `${Math.round((stats.succeeded / finished) * 1000) / 10}%` : "—";

  const monthLabel = new Date().toLocaleString(undefined, { month: "long" });

  const services: ServiceRow[] = [
    ...keyStatuses.map((status) => {
      const meta = PROVIDER_META[status.provider] ?? {
        name: status.provider,
        initials: status.provider.slice(0, 2).toUpperCase(),
        avatarIndex: 0
      };
      return {
        id: `key-${status.provider}`,
        name: meta.name,
        detail: status.configured
          ? status.updatedAt
            ? `Org key · updated ${formatRelativeTime(status.updatedAt)}`
            : "Org key configured"
          : "No org key yet — add under Integrations",
        initials: meta.initials,
        avatarIndex: meta.avatarIndex,
        state: status.configured ? "Connected" : "Not configured",
        tone: (status.configured ? "green" : "slate") as Tone,
        href: "/settings/integrations"
      };
    }),
    {
      id: "google-calendar",
      name: "Google Calendar",
      detail: googleConn?.accountEmail
        ? googleConn.accountEmail
        : googleCalendarConfigured()
          ? "Connect under Integrations"
          : "App credentials not configured",
      initials: "GC",
      avatarIndex: 4,
      state: googleConn ? "Connected" : "Not configured",
      tone: (googleConn ? "green" : "slate") as Tone,
      href: "/settings/integrations"
    },
    {
      id: "microsoft-calendar",
      name: "Microsoft Calendar",
      detail: msConn?.accountEmail
        ? msConn.accountEmail
        : microsoftCalendarConfigured()
          ? "Connect under Integrations"
          : "App credentials not configured",
      initials: "MS",
      avatarIndex: 3,
      state: msConn ? "Connected" : "Not configured",
      tone: (msConn ? "green" : "slate") as Tone,
      href: "/settings/integrations"
    },
    {
      id: "slack",
      name: "Slack notifications",
      detail: settings.delivery.slackWebhookUrl
        ? "Incoming webhook saved for your account"
        : "Add a webhook under Notifications",
      initials: "SL",
      avatarIndex: 5,
      state: settings.delivery.slackWebhookUrl ? "Connected" : "Not configured",
      tone: (settings.delivery.slackWebhookUrl ? "green" : "slate") as Tone,
      href: "/settings/notifications"
    },
    {
      id: "github-webhook",
      name: "GitHub reviews",
      detail: "Point a repo webhook at Integrations · Review webhooks",
      initials: "GH",
      avatarIndex: 0,
      state: "Webhook ingest",
      tone: "blue" as Tone,
      href: "/settings/integrations"
    },
    {
      id: "jira-webhook",
      name: "Jira reviews",
      detail: "Point a Jira webhook at Integrations · Review webhooks",
      initials: "JI",
      avatarIndex: 1,
      state: "Webhook ingest",
      tone: "blue" as Tone,
      href: "/settings/integrations"
    }
  ];

  return (
    <div className="stack-lg">
      <Card>
        <div className="card-pad row" style={{ gap: 16, flexWrap: "wrap" }}>
          <Avatar initials={initials(user.name)} index={0} size="lg" />
          <div className="stack" style={{ flex: 1, minWidth: 200 }}>
            <h3 className="card-title" style={{ fontSize: "1.1rem" }}>
              {user.name}
            </h3>
            <p className="card-sub">
              {user.email} · {session.organizationName} · {session.role}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Profile" bordered />
        <div className="card-pad">
          <ProfileForm name={user.name} email={user.email} orgName={session.organizationName ?? ""} />
        </div>
      </Card>

      <Card>
        <CardHead
          title={`AI usage · ${monthLabel}`}
          sub="From agent runs in this workspace. Token metering isn’t recorded yet."
          action={
            <Link href="/agents" className="btn-secondary btn-sm">
              View agents
            </Link>
          }
          bordered
        />
        <div className="card-pad stack-lg">
          <div className="grid-4">
            {[
              { label: "Runs this month", value: stats.thisMonth },
              { label: "Runs (7d)", value: stats.last7d },
              { label: "Success rate", value: successRate },
              { label: "Failed", value: stats.failed }
            ].map((s) => (
              <div key={s.label} className="stack" style={{ gap: 2 }}>
                <span className="stat-number" style={{ fontSize: "1.6rem" }}>
                  {s.value}
                </span>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {recentRuns.length > 0 ? (
            <div className="stack" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Recent runs
              </span>
              <div className="list" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
                {recentRuns.map((run) => (
                  <div key={run.id} className="list-row">
                    <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                      <span className="title mono">{run.agentType}</span>
                      <span className="meta truncate">
                        {(run.resultExcerpt || run.prompt || "—").slice(0, 72)}
                      </span>
                    </div>
                    <Pill
                      tone={
                        run.status === "succeeded"
                          ? "green"
                          : run.status === "failed"
                            ? "red"
                            : "amber"
                      }
                    >
                      {run.status}
                    </Pill>
                    <span className="muted" style={{ fontSize: "var(--fs-sm)", whiteSpace: "nowrap" }}>
                      {formatRelativeTime(run.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="dim" style={{ margin: 0 }}>
              No agent runs yet. Run a specialist from Agents or the AI Workspace to populate usage.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHead
          title="Connected services"
          sub="Live status for this workspace — never invented"
          action={
            <Link href="/settings/integrations" className="btn-secondary btn-sm">
              Manage
            </Link>
          }
          bordered
        />
        <div className="list">
          {services.map((svc) => (
            <Link key={svc.id} href={svc.href} className="list-row">
              <Avatar initials={svc.initials} index={svc.avatarIndex} square />
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="title">{svc.name}</span>
                <span className="meta truncate">{svc.detail}</span>
              </div>
              <Pill tone={svc.tone}>{svc.state}</Pill>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="API keys" sub="Programmatic access to this workspace" bordered />
        <div className="card-pad">
          <ApiKeysPanel
            canManage={canManageKeys}
            keys={apiKeys.map((k) => ({
              id: k.id,
              name: k.name,
              keyPrefix: k.keyPrefix,
              createdAt: k.createdAt,
              lastUsedAt: k.lastUsedAt,
              revokedAt: k.revokedAt
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
