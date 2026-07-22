import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { runPlatformHealthChecks, type HealthStatus } from "@/lib/platform/health";
import { listPlatformIncidents } from "@/lib/db/platform-incidents";
import { resolvePlatformIncidentAction } from "@/lib/actions/admin/incidents";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { CreateIncidentForm } from "@/components/admin/create-incident-form";
import type { Tone } from "@/lib/workspace/content";
import { formatAdminDateTime } from "@/lib/workspace/admin-ui";

function statusTone(status: HealthStatus): Tone {
  switch (status) {
    case "healthy":
      return "green";
    case "degraded":
      return "amber";
    case "down":
      return "red";
  }
}

function severityTone(severity: string): Tone {
  if (severity === "critical" || severity === "high") return "red";
  if (severity === "medium") return "amber";
  return "slate";
}

export default async function AdminStatusPage() {
  await requirePlatformAdmin();
  const [report, incidents] = await Promise.all([
    runPlatformHealthChecks(),
    listPlatformIncidents(40)
  ]);

  return (
    <div className="stack-lg">
      {report.openBanners.length > 0 ? (
        <div className="stack" style={{ gap: 8 }}>
          {report.openBanners.map((banner) => (
            <div
              key={banner.id}
              className="card card-pad row-between"
              style={{
                borderColor:
                  banner.severity === "critical" || banner.severity === "high"
                    ? "var(--danger, #b91c1c)"
                    : undefined,
                flexWrap: "wrap",
                gap: 12
              }}
              role="status"
            >
              <div className="stack" style={{ gap: 4, minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Pill tone={severityTone(banner.severity)}>{banner.severity}</Pill>
                  <span className="strong">{banner.title}</span>
                </div>
                {banner.summary ? (
                  <p className="dim" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5 }}>
                    {banner.summary}
                  </p>
                ) : null}
              </div>
              <form action={resolvePlatformIncidentAction}>
                <input type="hidden" name="id" value={banner.id} />
                <button type="submit" className="btn-secondary btn-sm">
                  Resolve
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <Pill tone={report.ok ? "green" : "red"}>{report.ok ? "All clear" : "Attention"}</Pill>
            <span className="dim" style={{ fontSize: "0.85rem" }}>
              Checked {formatAdminDateTime(report.checkedAt)}
            </span>
          </div>
          <p className="dim" style={{ margin: 0, fontSize: "0.875rem" }}>
            {report.incidentCount === 0
              ? "Every probe is healthy and no open banners."
              : `${report.probeIncidentCount} probe${report.probeIncidentCount === 1 ? "" : "s"} · ${report.openBannerCount} open banner${report.openBannerCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link href="/api/health" className="btn-secondary" target="_blank" rel="noreferrer">
          Open /api/health
        </Link>
      </div>

      <Card className="table-scroll admin-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Detail</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            {report.checks.map((check) => (
              <tr key={check.id}>
                <td style={{ fontWeight: 600 }}>{check.name}</td>
                <td>
                  <Pill tone={statusTone(check.status)}>{check.status}</Pill>
                </td>
                <td className="dim" style={{ fontSize: "0.875rem" }}>
                  {check.detail}
                </td>
                <td className="dim">{check.latencyMs != null ? `${check.latencyMs}ms` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHead title="Post incident banner" sub="Visible on this page and counted in the Status nav badge" bordered />
        <CreateIncidentForm />
      </Card>

      <Card className="table-scroll admin-table-card">
        <div style={{ padding: "1rem 1.25rem 0" }}>
          <CardHead title="Incident log" sub="Open and recently resolved banners" bordered />
        </div>
        {incidents.length === 0 ? (
          <p className="dim" style={{ padding: "1.25rem" }}>
            No platform incidents yet.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Opened</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id}>
                  <td>
                    <span className="strong">{inc.title}</span>
                    {inc.summary ? (
                      <span className="meta" style={{ display: "block" }}>
                        {inc.summary.length > 100 ? `${inc.summary.slice(0, 100)}…` : inc.summary}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <Pill tone={severityTone(inc.severity)}>{inc.severity}</Pill>
                  </td>
                  <td>
                    <Pill tone={inc.status === "open" ? "amber" : "green"}>{inc.status}</Pill>
                  </td>
                  <td className="dim">{formatAdminDateTime(inc.createdAt)}</td>
                  <td>
                    {inc.status === "open" ? (
                      <form action={resolvePlatformIncidentAction}>
                        <input type="hidden" name="id" value={inc.id} />
                        <button type="submit" className="btn-ghost btn-sm">
                          Resolve
                        </button>
                      </form>
                    ) : (
                      <span className="meta">{formatAdminDateTime(inc.resolvedAt)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
