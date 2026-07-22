import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Users, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import { listProjects } from "@/lib/db/queries";
import { PageHeader } from "@/components/app-shell/page-header";
import { Pill, Avatar, DemoNotice } from "@/components/workspace/ui";
import { NewProjectButton } from "@/components/projects/new-project-dialog";

const STATUS_TONE = { "On track": "green", "At risk": "amber", "Off track": "red" } as const;

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const projects = await listProjects(session.organizationId);
  const teams = new Set(projects.map((p) => p.lead)).size;
  const health = projects.length
    ? Math.round(projects.reduce((n, p) => n + p.progress, 0) / projects.length)
    : 0;
  return (
    <>
      <PageHeader
        title="Projects"
        description={`${projects.length} active projects · ${teams} leads · portfolio health ${health}%`}
        actions={<NewProjectButton />}
      />

      <DemoNotice>
        Projects are stored in your workspace database. Jira / Linear sync replaces this seed portfolio once
        connected.
      </DemoNotice>

      <div className="grid-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.slug}`} className="card card-pad project-card">
            <div className="row-between" style={{ alignItems: "flex-start" }}>
              <div className="row" style={{ gap: 12, minWidth: 0 }}>
                <Avatar initials={p.initials} index={p.avatarIndex} size="lg" square />
                <div className="stack" style={{ minWidth: 0 }}>
                  <span className="card-title truncate">{p.name}</span>
                  <span className="card-sub truncate">
                    {p.key} · {p.lead}
                  </span>
                </div>
              </div>
              <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
            </div>

            <div className="stack" style={{ gap: 7, marginTop: 18 }}>
              <div className="row-between" style={{ fontSize: "var(--fs-sm)" }}>
                <span className="muted">{p.sprintLabel}</span>
                <span className="strong">{p.progress}%</span>
              </div>
              <div className="bar">
                <span style={{ width: `${p.progress}%`, background: p.accent }} />
              </div>
            </div>

            <div
              className="row-between"
              style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: "var(--fs-sm)" }}
            >
              <span className="row" style={{ gap: 14 }}>
                <span className="row" style={{ gap: 5 }}>
                  <BarChart3 size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
                  <span className="strong">{p.openIssues}</span>
                  <span className="muted">open</span>
                </span>
                <span className="row" style={{ gap: 5 }}>
                  <Users size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
                  <span className="strong">{p.engineers}</span>
                  <span className="muted">eng</span>
                </span>
              </span>
              {p.warning ? (
                <span className="row" style={{ gap: 5, color: "var(--accent-red)", fontWeight: 600 }}>
                  <AlertTriangle size={14} aria-hidden />
                  {p.warning}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
