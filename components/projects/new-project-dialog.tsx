"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, AlertCircle } from "lucide-react";
import { RunButton } from "@/components/ui";
import { createProjectAction, type ProjectFormState } from "@/lib/actions/projects";
import { PROJECT_STATUSES } from "@/lib/db/schema";

/**
 * "New project" header button plus its modal. Kept together (unlike the task
 * dialog, which is opened from two places and therefore needs a provider)
 * because only this one button opens it.
 */
export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ProjectFormState, FormData>(createProjectAction, undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const lastSlug = useRef<string | undefined>(undefined);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Navigate into the project once the server confirms it was created.
  useEffect(() => {
    if (state?.slug && state.slug !== lastSlug.current) {
      lastSlug.current = state.slug;
      setOpen(false);
      router.push(`/projects/${state.slug}`);
    }
  }, [state, router]);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden />
        <span>New project</span>
      </button>

      <dialog
        ref={dialogRef}
        className="modal-dialog"
        aria-labelledby={titleId}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="row-between" style={{ marginBottom: 18 }}>
          <h2 id={titleId} className="card-title" style={{ fontSize: "1.05rem" }}>
            New project
          </h2>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close dialog">
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
          <div className="form-group">
            <label className="form-label" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              className="form-input"
              placeholder="Billing Platform"
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="project-key">
                Ticket key
              </label>
              <input
                id="project-key"
                name="key"
                required
                maxLength={6}
                className="form-input"
                placeholder="BILL"
                style={{ textTransform: "uppercase" }}
              />
              <span className="form-hint">Prefixes task IDs, e.g. BILL-101.</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="project-lead">
                Lead
              </label>
              <input
                id="project-lead"
                name="lead"
                required
                maxLength={60}
                defaultValue="Alex Morgan"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="project-status">
                Status
              </label>
              <select id="project-status" name="status" className="form-select" defaultValue="On track">
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="project-engineers">
                Engineers
              </label>
              <input
                id="project-engineers"
                name="engineers"
                type="number"
                min={1}
                max={500}
                defaultValue={3}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="project-sprint">
              Sprint
            </label>
            <input
              id="project-sprint"
              name="sprintLabel"
              required
              maxLength={60}
              defaultValue="Sprint 1 · day 1/10"
              className="form-input"
            />
          </div>

          <div className="row" style={{ gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <RunButton type="submit" loading={pending} idleLabel="Create project" loadingLabel="Creating…" />
          </div>
        </form>
      </dialog>
    </>
  );
}
