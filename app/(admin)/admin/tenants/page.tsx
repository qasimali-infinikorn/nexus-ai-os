import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformOverviewStats } from "@/lib/db/queries";
import { Card, CardHead, DemoNotice } from "@/components/workspace/ui";

export default async function AdminTenantsPage() {
  await requirePlatformAdmin();
  const stats = await getPlatformOverviewStats();

  return (
    <div className="stack-lg">
      <DemoNotice>
        Phase 3.1 will add the filterable tenant table, suspend/restore, and add-tenant. For now this
        page confirms live org totals only.
      </DemoNotice>
      <Card>
        <CardHead title="Organizations" sub="Coming next: All · Active · Trial · Past due tabs" />
        <p style={{ padding: "0 1.25rem 1.25rem" }}>
          <strong>{stats.tenantCount}</strong>
          <span className="dim"> total tenants in the database</span>
        </p>
      </Card>
    </div>
  );
}
