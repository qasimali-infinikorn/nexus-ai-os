"use client";

import { useOptimistic, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { Plus, GripVertical, ExternalLink } from "lucide-react";
import { Pill, Avatar } from "@/components/workspace/ui";
import { PRIORITY_TONE, KIND_TONE, STATUS_BAR, STATUS_ORDER } from "@/lib/workspace/task-ui";
import { moveTaskAction } from "@/lib/actions/projects";
import { useNewTaskDialog } from "./board-shell";
import type { ProjectTask, TaskStatus } from "@/lib/db/schema";

interface Props {
  projectSlug: string;
  tasks: ProjectTask[];
}

/**
 * Kanban board with native HTML5 drag-and-drop.
 *
 * Uses the platform's drag events rather than a DnD library to stay
 * dependency-free (consistent with the rest of this codebase). Because
 * pointer dragging is inaccessible on its own, every card is also focusable
 * and moves with the arrow keys, with each move announced through an
 * aria-live region — see `moveByKeyboard`.
 *
 * Moves are optimistic (useOptimistic) and persisted through
 * `moveTaskAction`; if the server rejects the move, the transition ends and
 * React discards the optimistic state, snapping the card back.
 */
export function KanbanBoard({ projectSlug, tasks }: Props) {
  const openNewTask = useNewTaskDialog();
  const [isPending, startTransition] = useTransition();
  const [optimisticTasks, applyMove] = useOptimistic(
    tasks,
    (state: ProjectTask[], move: { ref: string; status: TaskStatus; position: number }) => {
      const moving = state.find((t) => t.ref === move.ref);
      if (!moving) return state;
      const rest = state.filter((t) => t.ref !== move.ref);
      const target = rest.filter((t) => t.status === move.status);
      const others = rest.filter((t) => t.status !== move.status);
      target.splice(Math.min(move.position, target.length), 0, { ...moving, status: move.status });
      return [...others, ...target.map((t, i) => ({ ...t, sortOrder: i }))];
    }
  );

  const [draggingRef, setDraggingRef] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const liveRef = useRef<HTMLDivElement>(null);

  const column = (status: TaskStatus) =>
    optimisticTasks.filter((t) => t.status === status).sort((a, b) => a.sortOrder - b.sortOrder);

  const commitMove = (ref: string, status: TaskStatus, position: number, announce: string) => {
    startTransition(async () => {
      applyMove({ ref, status, position });
      setAnnouncement(announce);
      const res = await moveTaskAction({ ref, projectSlug, status, position });
      if (!res.ok) setAnnouncement(res.error ?? "Move failed.");
    });
  };

  const handleDrop = (status: TaskStatus) => {
    if (!draggingRef) return;
    const task = optimisticTasks.find((t) => t.ref === draggingRef);
    setOverColumn(null);
    setDraggingRef(null);
    if (!task || task.status === status) return;
    commitMove(draggingRef, status, column(status).length, `${task.ref} moved to ${status}.`);
  };

  const moveByKeyboard = (task: ProjectTask, direction: -1 | 1) => {
    const i = STATUS_ORDER.indexOf(task.status as TaskStatus);
    const next = STATUS_ORDER[i + direction];
    if (!next) return;
    commitMove(task.ref, next, column(next).length, `${task.ref} moved to ${next}.`);
  };

  return (
    <>
      <p className="muted" style={{ fontSize: "var(--fs-sm)" }} id="kanban-help">
        Drag a card between columns, or focus a card and press the left/right arrow keys to move it.
      </p>

      <div className="kanban" aria-busy={isPending}>
        {STATUS_ORDER.map((status) => {
          const items = column(status);
          return (
            <section
              key={status}
              className={`kanban-col${overColumn === status ? " drop-active" : ""}`}
              aria-label={status}
              onDragOver={(e) => {
                e.preventDefault();
                setOverColumn(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(status);
              }}
            >
              <div className="row-between" style={{ marginBottom: 12 }}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="status-dot" style={{ background: STATUS_BAR[status] }} aria-hidden />
                  <span className="strong" style={{ fontSize: "var(--fs-title)" }}>
                    {status}
                  </span>
                  <span className="muted">{items.length}</span>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 24, height: 24 }}
                  aria-label={`Add task to ${status}`}
                  onClick={() => openNewTask(status)}
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>

              <ul className="stack-md" style={{ listStyle: "none", minHeight: 24 }}>
                {items.map((t) => (
                  <li key={t.ref}>
                    <article
                      className={`kanban-card${draggingRef === t.ref ? " dragging" : ""}`}
                      draggable
                      tabIndex={0}
                      aria-roledescription="Draggable task"
                      aria-describedby="kanban-help"
                      onDragStart={(e) => {
                        setDraggingRef(t.ref);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", t.ref);
                      }}
                      onDragEnd={() => {
                        setDraggingRef(null);
                        setOverColumn(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") {
                          e.preventDefault();
                          moveByKeyboard(t, 1);
                        } else if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          moveByKeyboard(t, -1);
                        }
                      }}
                    >
                      <div className="row-between">
                        <span className="row" style={{ gap: 8 }}>
                          <Pill tone={KIND_TONE[t.kind]}>{t.kind}</Pill>
                          <span className="mono muted" style={{ fontSize: "var(--fs-sm)" }}>
                            {t.ref}
                          </span>
                          {t.source !== "manual" ? (
                            <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                              {t.source}
                            </span>
                          ) : null}
                        </span>
                        <GripVertical size={14} aria-hidden className="grip" />
                      </div>

                      <Link
                        href={`/projects/${projectSlug}/tasks/${t.ref}`}
                        className="strong task-link"
                        style={{ fontSize: "var(--fs-title)", lineHeight: 1.45 }}
                      >
                        {t.title}
                      </Link>

                      {t.externalUrl ? (
                        <a
                          href={t.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="row muted"
                          style={{ gap: 6, fontSize: "var(--fs-sm)", width: "fit-content" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={12} aria-hidden />
                          Open in {t.source === "jira" ? "Jira" : "GitHub"}
                        </a>
                      ) : null}

                      <div className="row-between">
                        <span className="row" style={{ gap: 8 }}>
                          <Pill tone={PRIORITY_TONE[t.priority]}>{t.priority}</Pill>
                          <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                            {t.points} pts
                          </span>
                        </span>
                        <Avatar initials={t.assignee} index={t.avatarIndex} />
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div ref={liveRef} role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
