import Link from "next/link";
import { CreditCard, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformOverviewStats } from "@/lib/db/queries";
import { formatUsdCents, getPlatformBillingStats } from "@/lib/db/billing";
import { stripeConfigured } from "@/lib/integrations/stripe";
import { Card, CardHead, DemoNotice, Pill } from "@/components/workspace/ui";
import { AreaChart } from "@/components/workspace/charts";
import { PLAN_LABELS, formatAdminDateTime } from "@/lib/workspace/admin-ui";

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const [stats, billing] = await Promise.all([getPlatformOverviewStats(), getPlatformBillingStats()]);
  const planTotal = stats.planMix.reduce((sum, row) => sum + row.count, 0) || 1;
  const configured = stripeConfigured();
  const chartPoints = billing.mrrSeries.map((p) => p.cents / 100);
  const chartLabels = billing.mrrSeries.map((p) => p.label);

  return (
    <div className="stack-lg">
      <DemoNotice>
        {configured
          ? billing.hasBillingData
            ? "Stripe webhook sync is live — MRR is the sum of active org mrr_cents; the chart uses paid invoice totals by month."
            : "Stripe is configured. Point Stripe at /api/webhooks/stripe and set Customer metadata organizationId (or link stripe_customer_id on the tenant)."
          : "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to enable invoice/MRR sync. Dollar KPIs stay empty until data arrives — never invented."}
      </DemoNotice>

      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              MRR
            </span>
            <CreditCard size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">{billing.hasBillingData ? formatUsdCents(billing.mrrCents) : "—"}</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            {billing.hasBillingData ? "From active subscriptions" : "Not connected"}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              ARR
            </span>
            <TrendingUp size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">{billing.hasBillingData ? formatUsdCents(billing.arrCents) : "—"}</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            {billing.hasBillingData ? "MRR × 12" : "Not connected"}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              Open / failed invoices
            </span>
            <AlertTriangle size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">{billing.hasBillingData ? billing.failedPaymentCount : "—"}</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            {billing.invoiceCount} invoices synced
          </p>
        </div>
        <Link href="/admin/tenants?status=trial" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              Trials (live)
            </span>
            <Users size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">{stats.trialCount}</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            {stats.pastDueCount} past due
          </p>
        </Link>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead
            title="Paid volume (12 mo)"
            sub="Sum of paid Stripe invoices by month — empty until sync"
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
                points={[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
                labels={["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
                height={180}
                color="#64748b"
                id="admin-mrr-empty-billing"
              />
              <p className="admin-chart-empty-label">No billing data connected</p>
            </div>
          )}
        </Card>

        <Card>
          <CardHead
            title="Billing provider"
            sub={configured ? "Stripe webhook ready" : "Not connected"}
          />
          <div style={{ padding: "0 1.25rem 1.25rem" }} className="stack">
            <p style={{ margin: 0 }}>
              {configured ? (
                <Pill tone="green">STRIPE_WEBHOOK_SECRET set</Pill>
              ) : (
                <Pill tone="slate">Missing Stripe env</Pill>
              )}
            </p>
            <p className="dim" style={{ margin: 0, fontSize: "0.875rem" }}>
              Webhook: <code>/api/webhooks/stripe</code>. Put the Nexus org UUID in Stripe Customer
              metadata as <code>organizationId</code>, or set <code>stripe_customer_id</code> on the
              tenant detail page.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead title="Subscription mix" sub="organizations.plan_tier — not billed revenue" />
          {stats.tenantCount === 0 ? (
            <p className="dim" style={{ padding: "0 1.25rem 1.25rem" }}>
              No organizations yet.
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

        <Card className="table-scroll admin-table-card">
          <div style={{ padding: "1rem 1.25rem 0" }}>
            <CardHead title="Recent invoices" sub="From Stripe webhook upserts" bordered />
          </div>
          {billing.recentInvoices.length === 0 ? (
            <p className="dim" style={{ padding: "1.25rem" }}>
              No invoices synced yet.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Org</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {billing.recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.organizationName}</td>
                    <td>{formatUsdCents(inv.amountCents)}</td>
                    <td>
                      <Pill tone={inv.status === "paid" ? "green" : inv.status === "open" ? "amber" : "slate"}>
                        {inv.status}
                      </Pill>
                    </td>
                    <td className="dim">{formatAdminDateTime(inv.paidAt ?? inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
