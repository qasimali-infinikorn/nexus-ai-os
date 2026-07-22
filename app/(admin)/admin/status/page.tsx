import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { runPlatformHealthChecks, type HealthStatus } from "@/lib/platform/health";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
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

export default async function AdminStatusPage() {
  await requirePlatformAdmin();
  const report = await runPlatformHealthChecks();

  return (
    <div className="stack-lg">
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
              ? "Every probe is healthy."
              : `${report.incidentCount} check${report.incidentCount === 1 ? "" : "s"} need attention.`}
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
        <CardHead title="Incidents" sub="Manual incident banners are not implemented yet" />
        <p className="dim" style={{ padding: "0 1.25rem 1.25rem", margin: 0 }}>
          Unhealthy probes above act as the current incident signal. A dedicated incident log can
          follow once on-call workflows need it.
        </p>
      </Card>
    </div>
  );
}
