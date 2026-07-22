import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Calendar, Hash } from "lucide-react";
import { auth } from "@/lib/auth";
import { getProjectTask, getProjectBySlug } from "@/lib/db/queries";
import { Card, CardHead, Pill, Avatar } from "@/components/workspace/ui";
import { PRIORITY_TONE, KIND_TONE, STATUS_BAR } from "@/lib/workspace/task-ui";
import { TaskEditForm } from "@/components/projects/task-edit-form";

export default async function TaskDetailPage({
  params
}: {
  params: Promise<{ slug: string; ref: string }>;
}) {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const { slug, ref } = await params;
  const project = await getProjectBySlug(session.organizationId, slug);
  const task = await getProjectTask(session.organizationId, decodeURIComponent(ref));
  if (!project || !task || task.projectSlug !== slug) notFound();

  return (
    <>
      <nav className="row" style={{ gap: 6, fontSize: "var(--fs-body)" }} aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <Link href={`/projects/${slug}`}>{project.name}</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <span className="muted mono">{task.ref}</span>
      </nav>

      <header className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Pill tone={KIND_TONE[task.kind]}>{task.kind}</Pill>
          <span className="mono muted">{task.ref}</span>
          <span className="row" style={{ gap: 7 }}>
            <span className="status-dot" style={{ background: STATUS_BAR[task.status] }} aria-hidden />
            <span className="dim">{task.status}</span>
          </span>
        </div>
        <h1 style={{ fontSize: "var(--fs-h1)" }}>{task.title}</h1>
      </header>

      <div className="with-rail">
        <Card>
          <CardHead title="Details" sub="Edit and save — changes persist to your workspace." bordered />
          <div className="card-pad">
            <TaskEditForm
              projectSlug={slug}
              taskRef={task.ref}
              title={task.title}
              description={task.description ?? ""}
              status={task.status}
              priority={task.priority}
              points={task.points}
            />
          </div>
        </Card>

        <div className="rail">
          <Card>
            <CardHead title="Properties" bordered />
            <div className="list">
              <div className="list-row">
                <span className="dim" style={{ flex: 1 }}>Assignee</span>
                <span className="row" style={{ gap: 8 }}>
                  <Avatar initials={task.assignee} index={task.avatarIndex} />
                  <span className="strong">{task.assignee}</span>
                </span>
              </div>
              <div className="list-row">
                <span className="dim" style={{ flex: 1 }}>Priority</span>
                <Pill tone={PRIORITY_TONE[task.priority]}>{task.priority}</Pill>
              </div>
              <div className="list-row">
                <span className="dim" style={{ flex: 1 }}>Points</span>
                <span className="row" style={{ gap: 6 }}>
                  <Hash size={13} aria-hidden style={{ color: "var(--text-muted)" }} />
                  <span className="strong">{task.points}</span>
                </span>
              </div>
              <div className="list-row">
                <span className="dim" style={{ flex: 1 }}>Sprint days</span>
                <span className="row" style={{ gap: 6 }}>
                  <Calendar size={13} aria-hidden style={{ color: "var(--text-muted)" }} />
                  <span className="strong">
                    D{task.startDay}–D{task.endDay}
                  </span>
                </span>
              </div>
              <div className="list-row">
                <span className="dim" style={{ flex: 1 }}>Updated</span>
                <span className="muted">{new Date(task.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>

          <Link href={`/projects/${slug}`} className="btn-secondary" style={{ width: "100%" }}>
            Back to board
          </Link>
        </div>
      </div>
    </>
  );
}
