import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getTenantDetailForAdmin } from "@/lib/db/queries";
import { listTenantFeatureFlagStates } from "@/lib/db/feature-flags";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { TenantStatusForm } from "@/components/admin/tenant-status-form";
import { TenantFlagOverrides } from "@/components/admin/tenant-flag-overrides";
import { formatAdminDate, PLAN_LABELS, STATUS_LABELS, statusTone } from "@/lib/workspace/admin-ui";

export default async function AdminTenantDetailPage({
  params
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requirePlatformAdmin();
  const { orgId } = await params;
  const detail = await getTenantDetailForAdmin(orgId);
  if (!detail) notFound();

  const { organization, members, pendingInvites } = detail;
  const flagStates = await listTenantFeatureFlagStates(organization.id);

  return (
    <div className="stack-lg">
      <Link
        href="/admin/tenants"
        className="row dim"
        style={{ gap: 6, fontSize: "0.875rem", textDecoration: "none", width: "fit-content" }}
      >
        <ArrowLeft size={14} aria-hidden />
        Tenants
      </Link>

      <header className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div className="stack">
          <h2 style={{ margin: 0, fontSize: "1.35rem" }}>{organization.name}</h2>
          <p className="dim" style={{ margin: 0, fontSize: "0.875rem" }}>
            {organization.slug} · created {formatAdminDate(organization.createdAt)}
          </p>
        </div>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <Pill tone={statusTone(organization.status)}>{STATUS_LABELS[organization.status]}</Pill>
          <TenantStatusForm
            organizationId={organization.id}
            suspended={organization.status === "suspended"}
          />
        </div>
      </header>

      <div className="grid-3">
        <Card>
          <CardHead title="Plan" />
          <p style={{ padding: "0 1.25rem 1.25rem", margin: 0 }}>{PLAN_LABELS[organization.planTier]}</p>
        </Card>
        <Card>
          <CardHead title="Seats" />
          <p style={{ padding: "0 1.25rem 1.25rem", margin: 0 }}>{members.length}</p>
        </Card>
        <Card>
          <CardHead title="Pending invites" />
          <p style={{ padding: "0 1.25rem 1.25rem", margin: 0 }}>{pendingInvites}</p>
        </Card>
      </div>

      <Card className="table-scroll admin-table-card">
        <div style={{ padding: "1rem 1.25rem 0" }}>
          <CardHead
            title="Feature flags"
            sub="Overrides win over global audience. Inherit restores plan rules."
            bordered
          />
        </div>
        <div style={{ padding: "0 0 0.5rem" }}>
          <TenantFlagOverrides
            organizationId={organization.id}
            rows={flagStates.map((s) => ({
              key: s.flag.key,
              name: s.flag.name,
              description: s.flag.description,
              audience: s.flag.audience,
              effective: s.effective,
              override: s.override,
              inherited: s.inherited
            }))}
          />
        </div>
      </Card>

      <Card className="table-scroll admin-table-card">
        <div style={{ padding: "1rem 1.25rem 0" }}>
          <CardHead title="Members" sub="Membership roles in this organization" bordered />
        </div>
        {members.length === 0 ? (
          <p className="dim" style={{ padding: "1.25rem" }}>
            No members yet — wait for the owner invite to be accepted.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td className="dim">{m.email}</td>
                  <td>{m.role}</td>
                  <td className="dim">{formatAdminDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
