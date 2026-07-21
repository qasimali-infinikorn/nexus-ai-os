import { Plus, CircleDot, Users } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Pill, Avatar, Bar, DemoNotice } from "@/components/workspace/ui";
import { projects, projectStats } from "@/lib/workspace/content";

const BAR_TONE = { green: "green", amber: "amber", red: "red" } as const;

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description={`${projectStats.active} active projects · ${projectStats.teams} teams · portfolio health ${projectStats.portfolioHealth}%`}
        actions={
          <button type="button" className="btn-primary">
            <Plus size={16} aria-hidden />
            <span>New project</span>
          </button>
        }
      />

      <DemoNotice>Demo portfolio. Jira / Linear sync replaces this once connected.</DemoNotice>

      <Card>
        <div className="list">
          {projects.map((p) => (
            <div key={p.id} className="list-row" style={{ alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <Avatar initials={p.initials} index={p.avatarIndex} size="lg" square />

              <div className="stack" style={{ flex: "1 1 220px", minWidth: 180 }}>
                <span className="title">{p.name}</span>
                <span className="meta">
                  {p.key} · {p.lead}
                </span>
              </div>

              <div style={{ flex: "0 0 auto" }}>
                <Pill tone={p.tone}>{p.status}</Pill>
              </div>

              <div className="stack" style={{ flex: "1 1 180px", minWidth: 150, gap: 6 }}>
                <div className="row-between" style={{ fontSize: "0.76rem" }}>
                  <span className="muted">{p.sprint}</span>
                  <span className="strong">{p.progress}%</span>
                </div>
                <Bar pct={p.progress} tone={BAR_TONE[p.tone as keyof typeof BAR_TONE]} />
              </div>

              <div className="row" style={{ gap: 16, flex: "0 0 auto", fontSize: "0.8rem" }}>
                <span className="row" style={{ gap: 5 }} title={`${p.openIssues} open issues`}>
                  <CircleDot size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
                  <span className="strong">{p.openIssues}</span>
                  <span className="muted">open</span>
                </span>
                <span className="row" style={{ gap: 5 }} title={`${p.engineers} engineers`}>
                  <Users size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
                  <span className="strong">{p.engineers}</span>
                  <span className="muted">eng</span>
                </span>
                {p.extra ? <Pill tone={p.extraTone ?? "slate"}>{p.extra}</Pill> : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
