import Link from "next/link";
import { Building2, AlertTriangle, Bot, DollarSign } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformOverviewStats } from "@/lib/db/queries";
import { formatUsdCents, getPlatformBillingStats } from "@/lib/db/billing";
import { getPlatformAgentRunStats } from "@/lib/db/workspace";
import { runPlatformHealthChecks } from "@/lib/platform/health";
import { Card, CardHead, DemoNotice, Pill } from "@/components/workspace/ui";
import { AreaChart, Donut } from "@/components/workspace/charts";
import { PLAN_LABELS } from "@/lib/workspace/admin-ui";

const PLAN_COLORS: Record<string, string> = {
  trial: "#94a3b8",
  team: "#3b82f6",
  business: "#8b5cf6",
  enterprise: "#10b981"
};

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const [stats, health, billing, agentRuns] = await Promise.all([
    getPlatformOverviewStats(),
    runPlatformHealthChecks(),
    getPlatformBillingStats(),
    getPlatformAgentRunStats()
  ]);
  const planTotal = stats.planMix.reduce((sum, row) => sum + row.count, 0) || 1;
  const donutSegments = stats.planMix.map((row) => ({
    label: PLAN_LABELS[row.plan as keyof typeof PLAN_LABELS] ?? row.plan,
    value: row.count,
    color: PLAN_COLORS[row.plan] ?? "#64748b"
  }));
  const chartPoints = billing.hasBillingData
    ? billing.mrrSeries.map((p) => p.cents / 100)
    : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const chartLabels = billing.hasBillingData
    ? billing.mrrSeries.map((p) => p.label)
    : ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const agentMixTotal = agentRuns.byAgent7d.reduce((sum, row) => sum + row.count, 0) || 1;

  return (
    <div className="stack-lg">
      <DemoNotice>
        Tenant counts, agent-run ledger, and system health are live.
        {billing.hasBillingData
          ? " Platform MRR reflects synced Stripe subscription MRR."
          : " Platform MRR stays empty until Stripe webhook sync — never invented."}
      </DemoNotice>

      <div className="grid-4 admin-kpi-row">
        <Link href="/admin/billing" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              Platform MRR
            </span>
            <DollarSign size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">{billing.hasBillingData ? formatUsdCents(billing.mrrCents) : "—"}</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            {billing.hasBillingData ? "From Stripe sync" : "Billing not connected"}
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
          <p className="stat-value">{agentRuns.runs7d}</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            {agentRuns.runs7d === 0
              ? agentRuns.totalRuns === 0
                ? "No runs recorded yet"
                : "None in the last 7 days"
              : `${agentRuns.succeeded7d} ok · ${agentRuns.failed7d} failed`}
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
            {health.ok
              ? "All clear"
              : `${health.probeIncidentCount} probe · ${health.openBannerCount} banner`}
          </p>
        </Link>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead
            title="Platform MRR (12 mo)"
            sub={
              billing.hasBillingData
                ? "Paid invoice volume by month"
                : "Chart shell only — no fabricated series until billing sync"
            }
            action={
              <Link href="/admin/billing" className="btn-ghost" style={{ fontSize: "0.8rem" }}>
                Billing
              </Link>
            }
          />
          {billing.hasBillingData ? (
            <div style={{ padding: "0 1.25rem 1.25rem" }}>
              <AreaChart
                points={chartPoints}
                labels={chartLabels}
                height={180}
                color="#10b981"
                id="admin-mrr-live"
              />
            </div>
          ) : (
            <div className="admin-chart-empty">
              <AreaChart
                points={chartPoints}
                labels={chartLabels}
                height={180}
                color="#64748b"
                id="admin-mrr-empty"
              />
              <p className="admin-chart-empty-label">No billing data connected</p>
            </div>
          )}
        </Card>

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
            <div className="admin-plan-mix">
              <Donut
                segments={donutSegments}
                size={148}
                thickness={18}
                centerLabel={String(stats.tenantCount)}
                centerSub="tenants"
              />
              <ul className="admin-plan-list" style={{ padding: 0, flex: 1 }}>
                {stats.planMix.map((row) => {
                  const pct = Math.round((row.count / planTotal) * 100);
                  return (
                    <li key={row.plan}>
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <span className="row" style={{ gap: 8, alignItems: "center" }}>
                          <span
                            className="admin-swatch"
                            style={{ background: PLAN_COLORS[row.plan] ?? "#64748b" }}
                            aria-hidden
                          />
                          {PLAN_LABELS[row.plan as keyof typeof PLAN_LABELS] ?? row.plan}
                        </span>
                        <span className="dim">
                          {row.count} · {pct}%
                        </span>
                      </div>
                      <div className="bar">
                        <span style={{ width: `${pct}%`, background: PLAN_COLORS[row.plan] }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead title="Tenant health" sub="Status breakdown from organizations.status" />
          <div className="admin-health-grid admin-health-grid-wide">
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

        <Card>
          <CardHead
            title="Runs by agent (7d)"
            sub="From agent_runs written by /api/orchestrate"
          />
          {agentRuns.byAgent7d.length === 0 ? (
            <p className="dim" style={{ padding: "0 1.25rem 1.25rem", margin: 0 }}>
              No agent runs in the last 7 days.
            </p>
          ) : (
            <ul className="admin-plan-list">
              {agentRuns.byAgent7d.map((row) => {
                const pct = Math.round((row.count / agentMixTotal) * 100);
                return (
                  <li key={row.agentType}>
                    <div className="row-between" style={{ marginBottom: 6 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono, ui-monospace, monospace)",
                          fontSize: "0.875rem"
                        }}
                      >
                        {row.agentType}
                      </span>
                      <span className="dim">
                        {row.count} · {pct}%
                      </span>
                    </div>
                    <div className="bar">
                      <span style={{ width: `${pct}%`, background: "#8b5cf6" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
