import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Server, Shield, Database, Users, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { listAgentRuns } from "@/lib/db/workspace";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Pill } from "@/components/workspace/ui";
import { formatRelativeTime } from "@/lib/workspace/admin-ui";
import { proposalTemplates } from "@/lib/workspace/content";

const TEMPLATE_ICON = { server: Server, shield: Shield, database: Database, users: Users };

export default async function ProposalStudioPage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const runs = (await listAgentRuns(session.organizationId, 40)).filter((r) => r.agentType === "proposal");

  return (
    <>
      <PageHeader
        title="Proposal Studio"
        description={
          runs.length > 0
            ? `${runs.length} recent proposal run${runs.length === 1 ? "" : "s"} in this workspace`
            : "No saved proposals yet — generate with the Solution Consultant agent"
        }
        actions={
          <Link href="/proposal-studio/new" className="btn-primary">
            <Sparkles size={16} aria-hidden />
            <span>Generate with AI</span>
          </Link>
        }
      />

      <section className="stack-md">
        <p className="section-label">Start from a template</p>
        <div className="grid-4">
          {proposalTemplates.map((t) => {
            const Icon = TEMPLATE_ICON[t.icon];
            return (
              <Link
                key={t.id}
                href="/proposal-studio/new"
                className="card card-pad stack-md"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className="stat-icon blue" style={{ width: 38, height: 38 }}>
                  <Icon size={18} aria-hidden />
                </span>
                <div className="stack" style={{ gap: 3 }}>
                  <span className="card-title">{t.title}</span>
                  <span className="card-sub">{t.subtitle}</span>
                </div>
                <span className="row" style={{ gap: 5, fontSize: "0.8rem", fontWeight: 600, color: "var(--accent)" }}>
                  Use template <ArrowRight size={13} aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="stack-md">
        <p className="section-label">Recent proposal runs</p>
        <Card>
          {runs.length === 0 ? (
            <div className="card-pad stack-md">
              <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
                Nothing here yet. Generate a proposal to record an agent run — there is no demo pipeline.
              </p>
              <Link href="/proposal-studio/new" className="btn-secondary" style={{ alignSelf: "flex-start" }}>
                <Sparkles size={15} aria-hidden />
                <span>Generate with AI</span>
              </Link>
            </div>
          ) : (
            <div className="list">
              {runs.map((run) => (
                <div key={run.id} className="list-row" style={{ gap: 12 }}>
                  <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <span className="title truncate">{(run.resultExcerpt || run.prompt).slice(0, 80)}</span>
                    <span className="meta">
                      {run.provider}/{run.model} · {formatRelativeTime(run.createdAt)}
                    </span>
                  </div>
                  <Pill
                    tone={
                      run.status === "succeeded" ? "green" : run.status === "failed" ? "red" : "amber"
                    }
                  >
                    {run.status}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </>
  );
}
