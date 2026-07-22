import Link from "next/link";
import { Building2, AlertTriangle, Bot, DollarSign } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformOverviewStats } from "@/lib/db/queries";
import { runPlatformHealthChecks } from "@/lib/platform/health";
import { Card, CardHead, DemoNotice, Pill } from "@/components/workspace/ui";
import { PLAN_LABELS } from "@/lib/workspace/admin-ui";

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const [stats, health] = await Promise.all([getPlatformOverviewStats(), runPlatformHealthChecks()]);
  const planTotal = stats.planMix.reduce((sum, row) => sum + row.count, 0) || 1;

  return (
    <div className="stack-lg">
      <DemoNotice>
        Tenant counts and system health are live. Platform MRR and agent runs stay empty until billing
        sync and a run ledger exist — they are not invented here.
      </DemoNotice>

      <div className="grid-4">
        <Link href="/admin/billing" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              Platform MRR
            </span>
            <DollarSign size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">—</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            Billing not connected
          </p>
        </Link>

        <Link href="/admin/tenants" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              Active tenants
            </span>
            <Building2 size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">{stats.activeCount}</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            {stats.tenantCount} total · {stats.trialCount} trial
          </p>
        </Link>

        <div className="stat-card">
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              Agent runs (7d)
            </span>
            <Bot size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">—</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            No run ledger yet
          </p>
        </div>

        <Link href="/admin/status" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              Open incidents
            </span>
            <AlertTriangle size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">{health.incidentCount}</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            {health.ok ? "All probes healthy" : "See System Status"}
          </p>
        </Link>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead
            title="Plan mix"
            sub={
              stats.tenantCount === 0
                ? "No organizations yet — first signup creates one."
                : `${stats.tenantCount} organization${stats.tenantCount === 1 ? "" : "s"} by plan tier`
            }
          />
          {stats.tenantCount === 0 ? (
            <p className="dim" style={{ padding: "0 1.25rem 1.25rem" }}>
              Empty — nothing to chart.
            </p>
          ) : (
            <ul className="admin-plan-list">
              {stats.planMix.map((row) => {
                const pct = Math.round((row.count / planTotal) * 100);
                return (
                  <li key={row.plan}>
                    <div className="row-between" style={{ marginBottom: 6 }}>
                      <span>{PLAN_LABELS[row.plan as keyof typeof PLAN_LABELS] ?? row.plan}</span>
                      <span className="dim">
                        {row.count} · {pct}%
                      </span>
                    </div>
                    <div className="bar">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="Tenant health" sub="Status breakdown from organizations.status" />
          <div className="admin-health-grid">
            <div>
              <Pill tone="green">Active</Pill>
              <p className="stat-value" style={{ fontSize: "1.5rem", marginTop: 8 }}>
                {stats.activeCount}
              </p>
            </div>
            <div>
              <Pill tone="amber">Trial</Pill>
              <p className="stat-value" style={{ fontSize: "1.5rem", marginTop: 8 }}>
                {stats.trialCount}
              </p>
            </div>
            <div>
              <Pill tone="red">Past due</Pill>
              <p className="stat-value" style={{ fontSize: "1.5rem", marginTop: 8 }}>
                {stats.pastDueCount}
              </p>
            </div>
            <div>
              <Pill tone="slate">Suspended</Pill>
              <p className="stat-value" style={{ fontSize: "1.5rem", marginTop: 8 }}>
                {stats.suspendedCount}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
