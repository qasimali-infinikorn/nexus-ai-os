import { Rocket, AlertTriangle, CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardHead, Pill, Bar, DemoNotice } from "@/components/workspace/ui";
import { AreaChart } from "@/components/workspace/charts";
import { devopsSummary, serviceHealth, deployments, incidents, requestSeries } from "@/lib/workspace/content";

export default function DevOpsPage() {
  return (
    <>
      <PageHeader
        title="DevOps"
        description={`${devopsSummary.environment} · ${devopsSummary.region} · ${devopsSummary.services} services · 1 active incident`}
        actions={
          <button type="button" className="btn-secondary">
            Acknowledge {devopsSummary.activeIncident}
          </button>
        }
      />

      <DemoNotice>
        Demo deployment and incident data. Connecting your CI pipeline and PagerDuty replaces it with live events —
        nothing here is real infrastructure telemetry.
      </DemoNotice>

      <div className="grid-4">
        {serviceHealth.map((m) => (
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
                  <span className="meta truncate">{d.detail}</span>
                </div>
                <Pill tone={d.tone}>{d.status}</Pill>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title={requestSeries.title} sub={requestSeries.subtitle} bordered />
          <div className="card-pad">
            <AreaChart points={requestSeries.points} id="requests" height={180} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Incidents" sub="Open and recently resolved" bordered />
        <div className="list">
          {incidents.map((i) => (
            <div key={i.id} className="list-row" style={{ alignItems: "flex-start", gap: 14 }}>
              <span className={`stat-icon ${i.tone === "green" ? "green" : "amber"}`} style={{ width: 32, height: 32 }}>
                {i.tone === "green" ? <CircleCheck size={15} aria-hidden /> : <AlertTriangle size={15} aria-hidden />}
              </span>
              <div className="stack" style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <span className="mono strong" style={{ fontSize: "0.82rem" }}>
                    {i.code}
                  </span>
                  <span className="title">{i.title}</span>
                </span>
                <p className="dim" style={{ fontSize: "0.85rem", lineHeight: 1.55 }}>
                  {i.summary}
                </p>
                <span className="meta">{i.ago}</span>
              </div>
              <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                <Pill tone="slate">{i.severity}</Pill>
                <Pill tone={i.tone}>{i.status}</Pill>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
