import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listOrgCustomAgents } from "@/lib/db/custom-agents";
import { AIWorkspaceClient } from "@/components/ai-workspace/workspace-client";

export default async function AIWorkspacePage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const custom = await listOrgCustomAgents(session.organizationId);

  return (
    <Suspense fallback={<p className="muted card-pad">Loading workspace…</p>}>
      <AIWorkspaceClient customAgents={custom.map((a) => ({ key: a.key, name: a.name }))} />
    </Suspense>
  );
}
