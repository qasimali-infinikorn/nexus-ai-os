import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { Card, CardHead, DemoNotice } from "@/components/workspace/ui";

export default async function AdminBillingPage() {
  await requirePlatformAdmin();

  return (
    <div className="stack-lg">
      <DemoNotice>
        Billing stays an honest empty state until Stripe (or manual plan fields) is connected in
        Phase 3.3 — no fabricated MRR.
      </DemoNotice>
      <Card>
        <CardHead title="Billing not connected" sub="MRR, ARR, invoices, and failed payments" />
        <p className="dim" style={{ padding: "0 1.25rem 1.25rem" }}>
          Connect a billing source to populate this view.
        </p>
      </Card>
    </div>
  );
}
