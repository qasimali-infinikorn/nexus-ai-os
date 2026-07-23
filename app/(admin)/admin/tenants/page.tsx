import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformOverviewStats, listTenantsForAdmin, type TenantAdminFilter } from "@/lib/db/queries";
import type { OrganizationStatus } from "@/lib/db/schema";
import { ORGANIZATION_STATUSES } from "@/lib/db/schema";
import { Card } from "@/components/workspace/ui";
import { Pill } from "@/components/workspace/ui";
import { AddTenantDialog } from "@/components/admin/add-tenant-dialog";
import { TenantStatusForm } from "@/components/admin/tenant-status-form";
import { formatAdminDate, PLAN_LABELS, STATUS_LABELS, statusTone } from "@/lib/workspace/admin-ui";
import { formatUsdCents } from "@/lib/db/billing";

const TABS: { id: TenantAdminFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "trial", label: "Trial" },
  { id: "past_due", label: "Past due" },
  { id: "suspended", label: "Suspended" }
];

function parseFilter(raw: string | undefined): TenantAdminFilter {
  if (!raw || raw === "all") return "all";
  return (ORGANIZATION_STATUSES as readonly string[]).includes(raw)
    ? (raw as OrganizationStatus)
    : "all";
}

export default async function AdminTenantsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const filter = parseFilter(params.status);
  const [tenants, stats] = await Promise.all([listTenantsForAdmin(filter), getPlatformOverviewStats()]);

  const counts: Record<TenantAdminFilter, number> = {
    all: stats.tenantCount,
    active: stats.activeCount,
    trial: stats.trialCount,
    past_due: stats.pastDueCount,
    suspended: stats.suspendedCount
  };

  return (
    <div className="stack-lg">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <p className="dim" style={{ margin: 0, fontSize: "0.9rem" }}>
          {counts[filter]} organization{counts[filter] === 1 ? "" : "s"}
          {filter !== "all" ? ` · ${STATUS_LABELS[filter]}` : ""}
        </p>
        <AddTenantDialog />
      </div>

      <nav className="tabs" aria-label="Tenant status">
        {TABS.map((tab) => {
          const href = tab.id === "all" ? "/admin/tenants" : `/admin/tenants?status=${tab.id}`;
          const active = filter === tab.id;
          return (
            <Link key={tab.id} href={href} className={`tab-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              {tab.label}
              <span className="dim" style={{ marginLeft: 6, fontWeight: 500 }}>
                {counts[tab.id]}
              </span>
            </Link>
          );
        })}
      </nav>

      <Card className="table-scroll admin-table-card">
        {tenants.length === 0 ? (
          <p className="dim" style={{ padding: "1.25rem" }}>
            No organizations in this filter.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Plan</th>
                <th>Seats</th>
                <th>Status</th>
                <th>MRR</th>
                <th>Last active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <Link href={`/admin/tenants/${tenant.id}`} style={{ fontWeight: 600 }}>
                      {tenant.name}
                    </Link>
                    <div className="dim" style={{ fontSize: "0.75rem" }}>
                      {tenant.slug}
                    </div>
                  </td>
                  <td>{PLAN_LABELS[tenant.planTier]}</td>
                  <td>{tenant.seatCount}</td>
                  <td>
                    <Pill tone={statusTone(tenant.status)}>{STATUS_LABELS[tenant.status]}</Pill>
                  </td>
                  <td className="dim">
                    {tenant.mrrCents != null ? formatUsdCents(tenant.mrrCents) : "—"}
                  </td>
                  <td className="dim">{formatAdminDate(tenant.lastActiveAt ?? tenant.createdAt)}</td>
                  <td>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/admin/tenants/${tenant.id}`} className="btn-ghost" style={{ fontSize: "0.8rem", padding: "6px 10px" }}>
                        View
                      </Link>
                      <TenantStatusForm organizationId={tenant.id} suspended={tenant.status === "suspended"} />
                    </div>
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
