import Link from "next/link";
import { redirect } from "next/navigation";
import { Play, Settings2, Bot, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAgentRunStats, listAgentRuns } from "@/lib/db/workspace";
import { listOrgCustomAgents } from "@/lib/db/custom-agents";
import { deleteCustomAgentAction } from "@/lib/actions/custom-agents";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { NewCustomAgentForm } from "@/components/agents/new-custom-agent-form";
import { agents } from "@/lib/workspace/content";
import type { AgentRun } from "@/lib/db/schema";

const STATUS_LABEL = { running: "Running", active: "Active", idle: "Idle" } as const;

/** Specialist pages that can actually run this agent's system prompt today. */
const RUN_HREF: Record<string, string> = {
  eng_lead: "/code-review",
  architecture: "/architecture",
  proposal: "/proposal-studio",
  research: "/research-center",
  knowledge: "/knowledge-base",
  client_meeting: "/meetings",
  documentation: "/ai-workspace"
};

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function runLabel(run: AgentRun): string {
  if (run.resultExcerpt) return run.resultExcerpt.slice(0, 48);
  if (run.prompt) return run.prompt.slice(0, 48);
  return `${run.agentType} run`;
}

function statusTone(status: AgentRun["status"]): "green" | "amber" | "red" | "slate" {
  if (status === "succeeded") return "green";
  if (status === "running") return "amber";
  if (status === "failed") return "red";
  return "slate";
}

export default async function AgentsPage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const canManage = session.role === "owner" || session.role === "admin";
  const [stats, runs, customAgents] = await Promise.all([
    getAgentRunStats(session.organizationId),
    listAgentRuns(session.organizationId, 20),
    listOrgCustomAgents(session.organizationId)
  ]);

  const succeeded = stats.byAgent.reduce((n, a) => n + a.count, 0);
  const successRate = stats.total > 0 ? `${Math.round((succeeded / stats.total) * 1000) / 10}%` : "—";

  const latestByType = new Map<string, AgentRun>();
  for (const run of runs) {
    if (!latestByType.has(run.agentType)) latestByType.set(run.agentType, run);
  }

  const catalogCount = agents.length + customAgents.length;

  return (
    <>
      <PageHeader
        title="Agents"
        description={`${catalogCount} agents · ${stats.last7d} runs this week · ${successRate} success rate`}
      />

      {canManage ? <NewCustomAgentForm /> : null}

      <div className="grid-3">
        {agents.map((a) => {
          const href = a.agentType ? RUN_HREF[a.agentType] : undefined;
          const latest = a.agentType ? latestByType.get(a.agentType) : undefined;
          const typeCount = a.agentType
            ? (stats.byAgent.find((b) => b.agentType === a.agentType)?.count ?? 0)
            : 0;
          const cardStatus =
            latest?.status === "running" ? "running" : latest ? "active" : "idle";

          return (
            <article key={a.id} className="agent-card">
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className={`stat-icon ${a.accent}`} style={{ width: 38, height: 38 }}>
                  <Bot size={18} aria-hidden />
                </span>
                <div className="stack" style={{ flex: 1 }}>
                  <h3 className="card-title">{a.name}</h3>
                  <span className="row" style={{ gap: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    <span className={`status-dot ${cardStatus}`} aria-hidden />
                    {STATUS_LABEL[cardStatus]}
                    {typeCount > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{typeCount} succeeded</span>
                      </>
                    ) : null}
                  </span>
                </div>
              </div>

              <p className="desc">{a.description}</p>

              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {a.integrations.map((i) => (
                  <span key={i} className="tag">
                    {i}
                  </span>
                ))}
              </div>

              <div className="row" style={{ gap: 8, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {latest ? (
                  <>
                    <span className="truncate">{runLabel(latest)}</span>
                    <span aria-hidden>·</span>
                    <span className="nowrap">{relativeTime(latest.createdAt)}</span>
                  </>
                ) : (
                  <span>No runs yet</span>
                )}
              </div>

              <div className="row" style={{ gap: 8, marginTop: "auto" }}>
                {href ? (
                  <Link href={href} className="btn-primary" style={{ flex: 1 }}>
                    <Play size={14} aria-hidden />
                    <span>Run</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    disabled
                    title="No live runner yet"
                  >
                    <Play size={14} aria-hidden />
                    <span>Run</span>
                  </button>
                )}
                <button type="button" className="icon-btn" aria-label={`Configure ${a.name}`} disabled>
                  <Settings2 size={16} aria-hidden />
                </button>
              </div>
            </article>
          );
        })}

        {customAgents.map((a) => {
          const latest = latestByType.get(a.key);
          const typeCount = stats.byAgent.find((b) => b.agentType === a.key)?.count ?? 0;
          const cardStatus =
            latest?.status === "running" ? "running" : latest ? "active" : "idle";
          const runHref = `/ai-workspace?agent=${encodeURIComponent(a.key)}`;

          return (
            <article key={a.id} className="agent-card">
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className={`stat-icon ${a.accent}`} style={{ width: 38, height: 38 }}>
                  <Bot size={18} aria-hidden />
                </span>
                <div className="stack" style={{ flex: 1 }}>
                  <h3 className="card-title">{a.name}</h3>
                  <span className="row" style={{ gap: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    <span className={`status-dot ${cardStatus}`} aria-hidden />
                    {STATUS_LABEL[cardStatus]}
                    <span aria-hidden>·</span>
                    <span>Custom</span>
                    {typeCount > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{typeCount} succeeded</span>
                      </>
                    ) : null}
                  </span>
                </div>
              </div>

              <p className="desc">{a.description}</p>

              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="tag">{a.key}</span>
              </div>

              <div className="row" style={{ gap: 8, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {latest ? (
                  <>
                    <span className="truncate">{runLabel(latest)}</span>
                    <span aria-hidden>·</span>
                    <span className="nowrap">{relativeTime(latest.createdAt)}</span>
                  </>
                ) : (
                  <span>No runs yet</span>
                )}
              </div>

              <div className="row" style={{ gap: 8, marginTop: "auto" }}>
                <Link href={runHref} className="btn-primary" style={{ flex: 1 }}>
                  <Play size={14} aria-hidden />
                  <span>Run</span>
                </Link>
                {canManage ? (
                  <form action={deleteCustomAgentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="icon-btn" aria-label={`Delete ${a.name}`}>
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <Card>
        <CardHead title="Recent runs" sub={`${stats.total} total · ${stats.last7d} in the last 7 days`} bordered />
        {runs.length === 0 ? (
          <p className="muted card-pad" style={{ textAlign: "center" }}>
            No agent runs yet. Use Run on a specialist to create one.
          </p>
        ) : (
          <div className="list">
            {runs.map((run) => (
              <div key={run.id} className="list-row" style={{ gap: 14 }}>
                <span className="stat-icon blue" style={{ width: 32, height: 32 }}>
                  <Bot size={15} aria-hidden />
                </span>
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span className="title truncate">{run.agentType}</span>
                    <Pill tone={statusTone(run.status)}>{run.status}</Pill>
                  </span>
                  <span className="meta truncate">
                    {run.provider}/{run.model} · {runLabel(run)}
                  </span>
                </div>
                <span className="meta nowrap">{relativeTime(run.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
