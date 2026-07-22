import { redirect } from "next/navigation";
import { Rocket, AlertTriangle, CircleCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  listDeployments,
  listIncidents,
  getDeploymentFrequency,
  countOpenIncidents
} from "@/lib/db/workspace";
import { acknowledgeIncidentAction, resolveIncidentAction } from "@/lib/actions/workspace";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardHead, Pill, Bar } from "@/components/workspace/ui";
import { AreaChart } from "@/components/workspace/charts";
import type { DeploymentStatus, IncidentSeverity, IncidentStatus } from "@/lib/db/schema";

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function deployTone(status: DeploymentStatus): "green" | "red" | "amber" | "slate" {
  if (status === "success") return "green";
  if (status === "failed") return "red";
  if (status === "in_progress") return "amber";
  return "slate";
}

function incidentTone(status: IncidentStatus): "green" | "amber" | "red" | "slate" {
  if (status === "resolved") return "green";
  if (status === "acknowledged") return "amber";
  if (status === "open") return "red";
  return "slate";
}

function severityLabel(severity: IncidentSeverity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function padFrequency(rows: { day: string; count: number }[], days = 14): { points: number[]; labels: string[] } {
  const map = new Map(rows.map((r) => [r.day, r.count]));
  const points: number[] = [];
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    points.push(map.get(key) ?? 0);
    labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  }
  return { points, labels };
}

export default async function DevOpsPage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const orgId = session.organizationId;
  const [deployments, incidents, openIncidents, frequency] = await Promise.all([
    listDeployments(orgId, 20),
    listIncidents(orgId, { limit: 20 }),
    countOpenIncidents(orgId),
    getDeploymentFrequency(orgId, 14)
  ]);

  const deploy14d = frequency.reduce((n, r) => n + r.count, 0);
  const recent = deployments.slice(0, 50);
  const successCount = recent.filter((d) => d.status === "success").length;
  const successRate = recent.length ? Math.round((successCount / recent.length) * 100) : 0;
  const chart = padFrequency(frequency, 14);
  const chartLabels =
    chart.labels.length >= 2 ? [chart.labels[0], chart.labels[chart.labels.length - 1]] : chart.labels;

  const stats = [
    {
      id: "open",
      label: "Open incidents",
      value: String(openIncidents),
      state: openIncidents === 0 ? "Healthy" : "Attention",
      tone: openIncidents === 0 ? ("green" as const) : ("amber" as const),
      pct: openIncidents === 0 ? 100 : Math.max(10, 100 - openIncidents * 15),
      bar: openIncidents === 0 ? ("green" as const) : ("amber" as const)
    },
    {
      id: "deploys",
      label: "Deploys (14d)",
      value: String(deploy14d),
      state: deploy14d > 0 ? "Active" : "Quiet",
      tone: "blue" as const,
      pct: Math.min(100, deploy14d * 8),
      bar: "green" as const
    },
    {
      id: "success",
      label: "Deploy success",
      value: recent.length ? `${successRate}%` : "—",
      state: successRate >= 90 ? "Stable" : recent.length ? "Watch" : "No data",
      tone: successRate >= 90 ? ("green" as const) : ("amber" as const),
      pct: recent.length ? successRate : 0,
      bar: successRate >= 90 ? ("green" as const) : ("amber" as const)
    },
    {
      id: "listed",
      label: "Recent deploys",
      value: String(deployments.length),
      state: "Listed",
      tone: "slate" as const,
      pct: Math.min(100, deployments.length * 10),
      bar: "green" as const
    }
  ];

  return (
    <>
      <PageHeader
        title="DevOps"
        description={`${openIncidents} open incidents · ${deploy14d} deploys in 14 days · ${recent.length ? `${successRate}% success` : "no deploy data yet"}`}
      />

      <p className="muted" style={{ fontSize: "0.85rem", marginTop: -8 }}>
        Ingest events with <code className="mono">POST /api/webhooks/devops</code> using{" "}
        <code className="mono">WEBHOOK_SECRET</code>.
      </p>

      <div className="grid-4">
        {stats.map((m) => (
          <div key={m.id} className="stat-card">
            <div className="row-between">
              <span style={{ fontSize: "0.84rem", fontWeight: 550, color: "var(--text-secondary)" }}>{m.label}</span>
              <Pill tone={m.tone}>{m.state}</Pill>
            </div>
            <span className="stat-number" style={{ fontSize: "1.7rem" }}>
              {m.value}
            </span>
            <Bar pct={m.pct} tone={m.bar} />
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Card>
          <CardHead title="Deployments & CI/CD" sub="Most recent across all services" bordered />
          {deployments.length === 0 ? (
            <p className="muted card-pad" style={{ textAlign: "center" }}>
              No deployments yet. Send a webhook event to populate this list.
            </p>
          ) : (
            <div className="list">
              {deployments.map((d) => (
                <div key={d.id} className="list-row">
                  <span className="stat-icon blue" style={{ width: 32, height: 32 }}>
                    <Rocket size={15} aria-hidden />
                  </span>
                  <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <span className="title truncate">
                      {d.service} <span className="mono muted">{d.version}</span>
                    </span>
                    <span className="meta truncate">{d.detail ?? relativeTime(d.createdAt)}</span>
                  </div>
                  <Pill tone={deployTone(d.status)}>{d.status}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Deployment frequency" sub="Last 14 days" bordered />
          <div className="card-pad">
            <AreaChart points={chart.points} labels={chartLabels} id="deploys-freq" height={180} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Incidents" sub="Open and recently resolved" bordered />
        {incidents.length === 0 ? (
          <p className="muted card-pad" style={{ textAlign: "center" }}>
            No incidents recorded.
          </p>
        ) : (
          <div className="list">
            {incidents.map((i) => {
              const tone = incidentTone(i.status);
              return (
                <div key={i.id} className="list-row" style={{ alignItems: "flex-start", gap: 14 }}>
                  <span
                    className={`stat-icon ${tone === "green" ? "green" : "amber"}`}
                    style={{ width: 32, height: 32 }}
                  >
                    {tone === "green" ? (
                      <CircleCheck size={15} aria-hidden />
                    ) : (
                      <AlertTriangle size={15} aria-hidden />
                    )}
                  </span>
                  <div className="stack" style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <span className="mono strong" style={{ fontSize: "0.82rem" }}>
                        {i.code}
                      </span>
                      <span className="title">{i.title}</span>
                    </span>
                    {i.summary ? (
                      <p className="dim" style={{ fontSize: "0.85rem", lineHeight: 1.55 }}>
                        {i.summary}
                      </p>
                    ) : null}
                    <span className="meta">{relativeTime(i.createdAt)}</span>
                  </div>
                  <div className="stack" style={{ gap: 8, flexShrink: 0, alignItems: "flex-end" }}>
                    <div className="row" style={{ gap: 8 }}>
                      <Pill tone="slate">{severityLabel(i.severity)}</Pill>
                      <Pill tone={tone}>{i.status}</Pill>
                    </div>
                    {i.status === "open" || i.status === "acknowledged" ? (
                      <div className="row" style={{ gap: 6 }}>
                        {i.status === "open" ? (
                          <form action={acknowledgeIncidentAction}>
                            <input type="hidden" name="incidentId" value={i.id} />
                            <button type="submit" className="btn-secondary btn-sm">
                              Acknowledge
                            </button>
                          </form>
                        ) : null}
                        <form action={resolveIncidentAction}>
                          <input type="hidden" name="incidentId" value={i.id} />
                          <button type="submit" className="btn-primary btn-sm">
                            Resolve
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
