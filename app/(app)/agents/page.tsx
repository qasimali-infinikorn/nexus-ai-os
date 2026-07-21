import Link from "next/link";
import { Play, Settings2, Plus, Bot } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { DemoNotice } from "@/components/workspace/ui";
import { agents, agentStats } from "@/lib/workspace/content";

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

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Agents"
        description={`${agentStats.count} specialized agents · ${agentStats.runsThisWeek} runs this week · ${agentStats.successRate} success rate`}
        actions={
          <button type="button" className="btn-primary">
            <Plus size={16} aria-hidden />
            <span>New agent</span>
          </button>
        }
      />

      <DemoNotice>
        Run counts and last-run timestamps are demo content. The <strong>Run</strong>{" "}button opens the page that
        executes that agent&rsquo;s real system prompt against your org&rsquo;s configured provider key.
      </DemoNotice>

      <div className="grid-3">
        {agents.map((a) => {
          const href = a.agentType ? RUN_HREF[a.agentType] : undefined;
          return (
            <article key={a.id} className="agent-card">
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className={`stat-icon ${a.accent}`} style={{ width: 38, height: 38 }}>
                  <Bot size={18} aria-hidden />
                </span>
                <div className="stack" style={{ flex: 1 }}>
                  <h3 className="card-title">{a.name}</h3>
                  <span className="row" style={{ gap: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    <span className={`status-dot ${a.status}`} aria-hidden />
                    {STATUS_LABEL[a.status]}
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
                <span className="truncate">{a.lastRun}</span>
                <span aria-hidden>·</span>
                <span className="nowrap">{a.lastRunAgo}</span>
              </div>

              <div className="row" style={{ gap: 8, marginTop: "auto" }}>
                {href ? (
                  <Link href={href} className="btn-primary" style={{ flex: 1 }}>
                    <Play size={14} aria-hidden />
                    <span>Run</span>
                  </Link>
                ) : (
                  <button type="button" className="btn-primary" style={{ flex: 1 }} disabled title="No live runner yet">
                    <Play size={14} aria-hidden />
                    <span>Run</span>
                  </button>
                )}
                <button type="button" className="icon-btn" aria-label={`Configure ${a.name}`}>
                  <Settings2 size={16} aria-hidden />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
