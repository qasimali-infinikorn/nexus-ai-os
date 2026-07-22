import Link from "next/link";
import { CreditCard, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformOverviewStats } from "@/lib/db/queries";
import { Card, CardHead, DemoNotice, Pill } from "@/components/workspace/ui";
import { PLAN_LABELS } from "@/lib/workspace/admin-ui";

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const stats = await getPlatformOverviewStats();
  const planTotal = stats.planMix.reduce((sum, row) => sum + row.count, 0) || 1;
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());

  return (
    <div className="stack-lg">
      <DemoNotice>
        {stripeConfigured
          ? "STRIPE_SECRET_KEY is present, but invoice sync is not wired yet — revenue KPIs stay empty until webhooks land."
          : "No Stripe (or other billing provider) connected. Dollar KPIs stay empty on purpose — plan mix below is live org data only."}
      </DemoNotice>

      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              MRR
            </span>
            <CreditCard size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">—</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            Not connected
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              ARR
            </span>
            <TrendingUp size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">—</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            Not connected
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="dim" style={{ fontSize: "0.8rem" }}>
              Failed payments
            </span>
            <AlertTriangle size={16} className="dim" aria-hidden />
          </div>
          <p className="stat-value">—</p>
          <p className="dim" style={{ fontSize: "0.8rem" }}>
            No invoice feed
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
            {stats.pastDueCount} past due · not a conversion rate
          </p>
        </Link>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead
            title="Billing provider"
            sub={stripeConfigured ? "Stripe key detected" : "Not connected"}
          />
          <div style={{ padding: "0 1.25rem 1.25rem" }} className="stack">
            <p style={{ margin: 0 }}>
              {stripeConfigured ? (
                <Pill tone="amber">Stripe key present · sync pending</Pill>
              ) : (
                <Pill tone="slate">No STRIPE_SECRET_KEY</Pill>
              )}
            </p>
            <p className="dim" style={{ margin: 0, fontSize: "0.875rem" }}>
              Connect Stripe Customer / Subscription IDs on organizations (Phase 3.3b) to populate
              invoices and MRR. Until then this console will not invent revenue.
            </p>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Subscription mix"
            sub="From organizations.plan_tier — not billed revenue"
          />
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
      </div>
    </div>
  );
}
