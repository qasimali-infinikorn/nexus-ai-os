import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { auth } from "@/lib/auth";
import { listProjectTasks, listProjects } from "@/lib/db/queries";
import { Card, Pill, Avatar } from "@/components/workspace/ui";
import { TaskDialogProvider, NewTaskButton } from "@/components/projects/board-shell";
import { KanbanBoard } from "@/components/projects/kanban-board";
import { PRIORITY_TONE, KIND_TONE, STATUS_BAR } from "@/lib/workspace/task-ui";

const VIEWS = ["Kanban", "List", "Timeline", "Roadmap"] as const;
type View = (typeof VIEWS)[number];
const DAYS = 10;

export default async function ProjectPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const { slug } = await params;
  const { view: rawView } = await searchParams;
  const project = (await listProjects(session.organizationId)).find((p) => p.slug === slug);
  if (!project) notFound();

  const view: View = VIEWS.includes(rawView as View) ? (rawView as View) : "Kanban";
  const tasks = await listProjectTasks(session.organizationId, slug);
  const completed = tasks.filter((t) => t.status === "Done").reduce((n, t) => n + t.points, 0);
  const committed = tasks.reduce((n, t) => n + t.points, 0);

  return (
    <TaskDialogProvider projectSlug={slug} refPrefix={project.key}>
      <header className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div className="row" style={{ gap: 14 }}>
          <Link
            href="/projects"
            className="icon-btn"
            aria-label="Back to projects"
            style={{ border: "1px solid var(--border)" }}
          >
            <ArrowLeft size={16} aria-hidden />
          </Link>
          <div className="stack">
            <span className="row" style={{ gap: 8 }}>
              <h1 style={{ fontSize: "var(--fs-h1)" }}>{project.name}</h1>
              <ChevronDown size={18} aria-hidden style={{ color: "var(--text-muted)" }} />
            </span>
            <p className="dim" style={{ fontSize: "var(--fs-body)" }}>
              {tasks.length} tasks · {committed} points committed · {completed} completed
            </p>
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <nav className="view-switch" aria-label="Project view">
            {VIEWS.map((v) => (
              <Link
                key={v}
                href={`/projects/${slug}?view=${v}`}
                className={v === view ? "active" : ""}
                aria-current={v === view ? "page" : undefined}
              >
                {v}
              </Link>
            ))}
          </nav>
          <NewTaskButton />
        </div>
      </header>

      {view === "Kanban" ? <KanbanBoard projectSlug={slug} tasks={tasks} /> : null}

      {view === "List" ? (
        <Card>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Task</th>
                  <th scope="col">Status</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Points</th>
                  <th scope="col">Assignee</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.ref}>
                    <td className="mono muted nowrap">{t.ref}</td>
                    <td>
                      <span className="row" style={{ gap: 10 }}>
                        <Pill tone={KIND_TONE[t.kind]}>{t.kind}</Pill>
                        <Link href={`/projects/${slug}/tasks/${t.ref}`} className="strong task-link">
                          {t.title}
                        </Link>
                      </span>
                    </td>
                    <td className="nowrap">
                      <span className="row" style={{ gap: 7 }}>
                        <span className="status-dot" style={{ background: STATUS_BAR[t.status] }} aria-hidden />
                        <span className="dim">{t.status}</span>
                      </span>
                    </td>
                    <td>
                      <Pill tone={PRIORITY_TONE[t.priority]}>{t.priority}</Pill>
                    </td>
                    <td className="strong">{t.points}</td>
                    <td>
                      <Avatar initials={t.assignee} index={t.avatarIndex} />
                    </td>
                    <td>
                      <Link
                        href={`/projects/${slug}/tasks/${t.ref}`}
                        className="icon-btn"
                        aria-label={`Open ${t.ref}`}
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <ArrowRight size={14} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {view === "Timeline" ? (
        <Card>
          <div className="card-pad table-scroll">
            <div className="timeline">
              <div className="timeline-head">
                <span />
                {Array.from({ length: DAYS }, (_, i) => (
                  <span key={i} className="chart-axis-label">
                    D{i + 1}
                  </span>
                ))}
              </div>

              {tasks.map((t) => (
                <div className="timeline-row" key={t.ref}>
                  <span className="row timeline-label" style={{ gap: 8 }}>
                    <Pill tone={KIND_TONE[t.kind]}>{t.kind}</Pill>
                    <span className="truncate dim">{t.title}</span>
                  </span>
                  <div className="timeline-track">
                    <span
                      className="timeline-bar"
                      style={{
                        left: `${((t.startDay - 1) / DAYS) * 100}%`,
                        width: `${((t.endDay - t.startDay + 1) / DAYS) * 100}%`,
                        background: STATUS_BAR[t.status]
                      }}
                    >
                      {t.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {view === "Roadmap" ? (
        <Card>
          <div className="card-pad stack-md">
            <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
              Roadmap planning isn&rsquo;t configured for this project yet. Use Kanban, List, or Timeline for live
              tasks. Quarterly roadmap items will appear here when that feature ships — we don&rsquo;t invent
              milestones.
            </p>
          </div>
        </Card>
      ) : null}
    </TaskDialogProvider>
  );
}
