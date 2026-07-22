"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { X, AlertCircle } from "lucide-react";
import { RunButton } from "@/components/ui";
import { createTaskAction, type TaskFormState } from "@/lib/actions/projects";
import { TASK_KINDS, TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from "@/lib/db/schema";

/**
 * Create-task modal. Uses <dialog showModal()> so focus trapping, Escape
 * to close, and inertness of the background come from the platform rather
 * than hand-rolled key handling.
 */
export function NewTaskDialog({
  open,
  onClose,
  projectSlug,
  refPrefix,
  defaultStatus
}: {
  open: boolean;
  onClose: () => void;
  projectSlug: string;
  refPrefix: string;
  defaultStatus: TaskStatus;
}) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(createTaskAction, undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const lastRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Close once the server confirms the task was created.
  useEffect(() => {
    if (state?.ref && state.ref !== lastRef.current) {
      lastRef.current = state.ref;
      onClose();
    }
  }, [state, onClose]);

  return (
    <dialog ref={dialogRef} className="modal-dialog" aria-labelledby={titleId} onCancel={onClose} onClose={onClose}>
      <div className="row-between" style={{ marginBottom: 18 }}>
        <h2 id={titleId} className="card-title" style={{ fontSize: "1.05rem" }}>
          New task
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
          <X size={16} aria-hidden />
        </button>
      </div>

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <form action={action}>
        <input type="hidden" name="projectSlug" value={projectSlug} />
        <input type="hidden" name="refPrefix" value={refPrefix} />

        <div className="form-group">
          <label className="form-label" htmlFor="task-title">
            Title
          </label>
          <input
            id="task-title"
            name="title"
            required
            minLength={3}
            maxLength={200}
            className="form-input"
            placeholder="Add circuit breaker to gateway client"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="task-description">
            Description <span className="form-hint">(optional)</span>
          </label>
          <textarea
            id="task-description"
            name="description"
            maxLength={5000}
            className="form-textarea"
            style={{ minHeight: 90 }}
            placeholder="Context, acceptance criteria, links…"
          />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="task-kind">
              Type
            </label>
            <select id="task-kind" name="kind" className="form-select" defaultValue="task">
              {TASK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-status">
              Status
            </label>
            <select id="task-status" name="status" className="form-select" defaultValue={defaultStatus}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-priority">
              Priority
            </label>
            <select id="task-priority" name="priority" className="form-select" defaultValue="Med">
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-points">
              Points
            </label>
            <input
              id="task-points"
              name="points"
              type="number"
              min={0}
              max={100}
              defaultValue={3}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="task-assignee">
            Assignee
          </label>
          <input
            id="task-assignee"
            name="assignee"
            required
            maxLength={40}
            defaultValue="Alex Morgan"
            className="form-input"
          />
        </div>

        <div className="row" style={{ gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <RunButton type="submit" loading={pending} idleLabel="Create task" loadingLabel="Creating…" />
        </div>
      </form>
    </dialog>
  );
}
