import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db/queries";
import { Card, CardHead, Pill, Avatar, Bar, DemoNotice } from "@/components/workspace/ui";
import { usageStats, connectedServices, preferences } from "@/lib/workspace/content";
import { ProfileForm } from "./profile-form";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await getUserById(session.user.id);
  if (!user) return null;

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
        <CardHead title="AI usage · this month" bordered />
        <div className="card-pad stack-lg">
          <DemoNotice>
            Usage figures are demo content — per-org run metering lands with the agent-runs table.
          </DemoNotice>

          <div className="grid-4">
            <div className="stack" style={{ gap: 6 }}>
              <span className="row" style={{ gap: 6, alignItems: "baseline" }}>
                <span className="stat-number" style={{ fontSize: "1.6rem" }}>
                  {usageStats.tokensUsed}
                </span>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  / {usageStats.tokenLimit} tokens
                </span>
              </span>
              <Bar pct={usageStats.tokenPct} />
            </div>
            {[
              { label: "Agent runs", value: usageStats.agentRuns },
              { label: "Docs generated", value: usageStats.docsGenerated },
              { label: "Success rate", value: usageStats.successRate }
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
        </div>
      </Card>

      <Card>
        <CardHead title="Preferences" bordered />
        <div className="list">
          {preferences.map((p) => (
            <div key={p.id} className="list-row">
              <div className="stack" style={{ flex: 1 }}>
                <span className="title">{p.title}</span>
                <span className="meta">{p.body}</span>
              </div>
              <Pill tone={p.on ? "green" : "slate"}>{p.on ? "On" : "Off"}</Pill>
            </div>
          ))}
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
          {connectedServices.map((s) => (
            <div key={s.id} className="list-row">
              <Avatar initials={s.initials} index={s.avatarIndex} square />
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="title">{s.name}</span>
                <span className="meta truncate">{s.detail}</span>
              </div>
              <Pill tone={s.connected ? "green" : "slate"}>{s.connected ? "Connected" : "Connect"}</Pill>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
