import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db/queries";
import { getAgentRunStats, listAgentRuns } from "@/lib/db/workspace";
import { Card, CardHead, Pill, Avatar, DemoNotice } from "@/components/workspace/ui";
import { connectedServices, apiKeys } from "@/lib/workspace/settings-content";
import { formatRelativeTime } from "@/lib/workspace/admin-ui";
import { KeyRound, Plus } from "lucide-react";
import { ProfileForm } from "./profile-form";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) return null;

  const [stats, recentRuns] = await Promise.all([
    getAgentRunStats(session.organizationId),
    listAgentRuns(session.organizationId, 5)
  ]);

  const finished = stats.succeeded + stats.failed;
  const successRate =
    finished > 0 ? `${Math.round((stats.succeeded / finished) * 1000) / 10}%` : "—";

  const monthLabel = new Date().toLocaleString(undefined, { month: "long" });

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
          sub="Managed per organization"
          action={
            <Link href="/settings/integrations" className="btn-secondary btn-sm">
              Manage
            </Link>
          }
          bordered
        />
        <div className="list">
          {connectedServices.map((svc) => (
            <div key={svc.id} className="list-row">
              <Avatar initials={svc.initials} index={svc.avatarIndex} square />
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="title">{svc.name}</span>
                <span className="meta truncate">{svc.detail}</span>
              </div>
              <Pill tone={svc.state === "Connected" ? "green" : "amber"}>{svc.state}</Pill>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead
          title="API keys"
          sub="Programmatic access to this workspace"
          action={
            <button type="button" className="btn-secondary btn-sm" disabled title="Not implemented yet">
              <Plus size={13} aria-hidden />
              <span>Generate</span>
            </button>
          }
          bordered
        />
        <div className="card-pad">
          <DemoNotice>
            Sample keys — issuing real API keys isn&rsquo;t implemented yet, so nothing here grants access.
          </DemoNotice>
        </div>
        <div className="list">
          {apiKeys.map((k) => (
            <div key={k.id} className="list-row">
              <span className="stat-icon violet" style={{ width: 32, height: 32 }}>
                <KeyRound size={15} aria-hidden />
              </span>
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="title">{k.name}</span>
                <span className="meta mono">{k.masked}</span>
              </div>
              <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>{k.lastUsed}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
