import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { Card, CardHead, DemoNotice } from "@/components/workspace/ui";

export default async function AdminStatusPage() {
  await requirePlatformAdmin();

  return (
    <div className="stack-lg">
      <DemoNotice>
        System status health checks (API, Postgres, orchestrate, auth) land in Phase 3.3.
      </DemoNotice>
      <Card>
        <CardHead title="No status probes yet" sub="Services will appear here once wired" />
        <p className="dim" style={{ padding: "0 1.25rem 1.25rem" }}>
          Assume healthy until this page reports otherwise — do not treat silence as a green board.
        </p>
      </Card>
    </div>
  );
}
