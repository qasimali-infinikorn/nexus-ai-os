import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { listAgentRuns } from "@/lib/db/workspace";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Pill } from "@/components/workspace/ui";
import { formatRelativeTime } from "@/lib/workspace/admin-ui";

export default async function ResearchCenterPage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const runs = (await listAgentRuns(session.organizationId, 40)).filter((r) => r.agentType === "research");

  return (
    <>
      <PageHeader
        title="Research Center"
        description={
          runs.length > 0
            ? `${runs.length} recent research run${runs.length === 1 ? "" : "s"} — no curated digest feed yet`
            : "No research digest feed yet — run a live query with your org model"
        }
        actions={
          <Link href="/research-center/ask" className="btn-primary">
            <Sparkles size={15} aria-hidden />
            <span>Ask research</span>
          </Link>
        }
      />

      <Card>
        {runs.length === 0 ? (
          <div className="card-pad stack-md" style={{ maxWidth: 520 }}>
            <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
              Daily digests and bookmarks are not configured. Use the research runner for live answers — results
              appear here as agent runs.
            </p>
            <Link href="/research-center/ask" className="btn-secondary" style={{ alignSelf: "flex-start" }}>
              <Sparkles size={15} aria-hidden />
              <span>Open research runner</span>
            </Link>
          </div>
        ) : (
          <div className="list">
            {runs.map((run) => (
              <div key={run.id} className="list-row" style={{ gap: 12 }}>
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span className="title truncate">{(run.resultExcerpt || run.prompt).slice(0, 90)}</span>
                  <span className="meta">
                    {run.provider}/{run.model} · {formatRelativeTime(run.createdAt)}
                  </span>
                </div>
                <Pill
                  tone={run.status === "succeeded" ? "green" : run.status === "failed" ? "red" : "amber"}
                >
                  {run.status}
                </Pill>
                <Link href="/research-center/ask" className="btn-ghost btn-sm">
                  Ask again
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
