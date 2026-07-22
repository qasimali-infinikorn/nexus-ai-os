"use client";

import { useActionState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { RunButton } from "@/components/ui";
import { updateTaskAction, type TaskFormState } from "@/lib/actions/projects";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/db/schema";

export function TaskEditForm({
  projectSlug,
  taskRef,
  title,
  description,
  status,
  priority,
  points
}: {
  projectSlug: string;
  taskRef: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  points: number;
}) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(updateTaskAction, undefined);

  return (
    <form action={action}>
      <input type="hidden" name="projectSlug" value={projectSlug} />
      <input type="hidden" name="ref" value={taskRef} />

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}
      {state?.success ? (
        <div className="save-notice" role="status">
          <Check size={16} aria-hidden />
          <span>{state.success}</span>
        </div>
      ) : null}

      <div className="form-group">
        <label className="form-label" htmlFor="edit-title">
          Title
        </label>
        <input
          id="edit-title"
          name="title"
          defaultValue={title}
          required
          minLength={3}
          maxLength={200}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="edit-description">
          Description
        </label>
        <textarea
          id="edit-description"
          name="description"
          defaultValue={description}
          maxLength={5000}
          className="form-textarea"
          style={{ minHeight: 140 }}
          placeholder="Context, acceptance criteria, links…"
        />
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="edit-status">
            Status
          </label>
          <select id="edit-status" name="status" className="form-select" defaultValue={status}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-priority">
            Priority
          </label>
          <select id="edit-priority" name="priority" className="form-select" defaultValue={priority}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-points">
            Points
          </label>
          <input
            id="edit-points"
            name="points"
            type="number"
            min={0}
            max={100}
            defaultValue={points}
            className="form-input"
          />
        </div>
      </div>

      <RunButton type="submit" loading={pending} idleLabel="Save changes" loadingLabel="Saving…" />
    </form>
  );
}
