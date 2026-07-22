"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { createMeetingAction, type WorkspaceFormState } from "@/lib/actions/workspace";

export function CreateMeetingForm() {
  const [state, action, pending] = useActionState<WorkspaceFormState, FormData>(
    createMeetingAction,
    undefined
  );

  return (
    <form action={action} className="card card-pad stack-md">
      <div className="stack" style={{ gap: 4 }}>
        <h3 className="card-title" style={{ fontSize: "1rem" }}>
          Create meeting
        </h3>
        <p className="card-sub">Manual entry — Google Calendar sync is available under Integrations.</p>
      </div>

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}
      {state?.success ? (
        <p className="meta" role="status" style={{ color: "var(--accent-green, #059669)" }}>
          {state.success}
        </p>
      ) : null}

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="meeting-title">
            Title
          </label>
          <input
            id="meeting-title"
            name="title"
            required
            minLength={2}
            maxLength={120}
            className="form-input"
            placeholder="Sprint planning"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="meeting-starts">
            Starts at
          </label>
          <input id="meeting-starts" name="startsAt" type="datetime-local" required className="form-input" />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="meeting-location">
            Location
          </label>
          <input
            id="meeting-location"
            name="location"
            maxLength={120}
            className="form-input"
            placeholder="Zoom / Room 4"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="meeting-attendees">
            Attendees
          </label>
          <input
            id="meeting-attendees"
            name="attendees"
            maxLength={500}
            className="form-input"
            placeholder="Alex, Priya, Sam"
          />
          <span className="form-hint">Comma-separated names</span>
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? "Creating…" : "Create meeting"}
      </button>
    </form>
  );
}
