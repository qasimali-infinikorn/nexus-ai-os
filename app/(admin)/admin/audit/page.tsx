import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { Card, CardHead, DemoNotice } from "@/components/workspace/ui";

export default async function AdminAuditPage() {
  await requirePlatformAdmin();

  return (
    <div className="stack-lg">
      <DemoNotice>
        `platform_audit_events` and this feed ship with Tenants actions in Phase 3.1.
      </DemoNotice>
      <Card>
        <CardHead title="Audit log empty" sub="Append-only privileged actions will show here" />
        <p className="dim" style={{ padding: "0 1.25rem 1.25rem" }}>
          No platform audit events yet.
        </p>
      </Card>
    </div>
  );
}
