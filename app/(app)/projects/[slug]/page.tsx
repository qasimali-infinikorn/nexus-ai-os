import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { auth } from "@/lib/auth";
import { listProjectTasks, listProjects } from "@/lib/db/queries";
import { Card, Pill, Avatar, DemoNotice } from "@/components/workspace/ui";
import { TaskDialogProvider, NewTaskButton } from "@/components/projects/board-shell";
import { KanbanBoard } from "@/components/projects/kanban-board";
import { PRIORITY_TONE, KIND_TONE, STATUS_BAR } from "@/lib/workspace/task-ui";
import { boardSummary, roadmap } from "@/lib/workspace/content";

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
              Day {boardSummary.day} of {boardSummary.totalDays} · {committed} points committed · {completed}{" "}
              completed
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

      <DemoNotice>
        Tasks are stored in your workspace database — drag, create, and edit them freely. Connecting Jira or
        Linear replaces this board with your real backlog.
      </DemoNotice>

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
                  <span
                    key={i}
                    className="chart-axis-label"
                    style={{
                      color: i + 1 === boardSummary.day ? "var(--accent)" : undefined,
                      fontWeight: i + 1 === boardSummary.day ? 700 : 500
                    }}
                  >
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
        <div className="grid-4" style={{ alignItems: "start" }}>
          {roadmap.map((q) => (
            <section key={q.id} className="card roadmap-col" aria-label={`${q.quarter} — ${q.theme}`}>
              <header
                className="roadmap-head"
                style={{ background: `color-mix(in srgb, ${q.accent} 8%, transparent)` }}
              >
                <p className="strong" style={{ color: q.accent, fontSize: "var(--fs-title)" }}>
                  {q.quarter}
                </p>
                <p className="card-sub">{q.theme}</p>
              </header>
              <div className="card-pad stack-md">
                {q.items.map((it) => (
                  <article key={it.id} className="roadmap-card">
                    <p className="strong" style={{ fontSize: "var(--fs-title)", lineHeight: 1.45 }}>
                      {it.title}
                    </p>
                    <div className="row" style={{ gap: 10, marginTop: 10 }}>
                      <Pill tone={it.tone}>{it.state}</Pill>
                      <span className="bar" style={{ flex: 1 }}>
                        <span style={{ width: `${it.progress}%`, background: q.accent }} />
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </TaskDialogProvider>
  );
}
