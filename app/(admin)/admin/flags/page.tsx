import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { Card, CardHead, DemoNotice } from "@/components/workspace/ui";

export default async function AdminFlagsPage() {
  await requirePlatformAdmin();

  return (
    <div className="stack-lg">
      <DemoNotice>
        Feature flags schema and toggles ship in Phase 3.2 (`feature_flags` + audit writes).
      </DemoNotice>
      <Card>
        <CardHead
          title="No flags yet"
          sub="Planned keys: ai-workspace, live-meetings, proposal-studio, byo-model, sso-scim, usage-billing"
        />
        <p className="dim" style={{ padding: "0 1.25rem 1.25rem" }}>
          Empty until the flags migration lands.
        </p>
      </Card>
    </div>
  );
}
