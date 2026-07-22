"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import {
  createPlatformIncidentAction,
  type IncidentFormState
} from "@/lib/actions/admin/incidents";
import { PLATFORM_INCIDENT_SEVERITIES } from "@/lib/db/schema";

export function CreateIncidentForm() {
  const [state, action, pending] = useActionState<IncidentFormState, FormData>(
    createPlatformIncidentAction,
    undefined
  );

  return (
    <form action={action} className="stack-md" style={{ padding: "0 1.25rem 1.25rem" }}>
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
          <label className="form-label" htmlFor="incident-title">
            Title
          </label>
          <input
            id="incident-title"
            name="title"
            required
            minLength={3}
            maxLength={160}
            className="form-input"
            placeholder="Elevated API error rates"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="incident-severity">
            Severity
          </label>
          <select id="incident-severity" name="severity" className="form-select" defaultValue="medium">
            {PLATFORM_INCIDENT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="incident-summary">
          Summary
        </label>
        <textarea
          id="incident-summary"
          name="summary"
          maxLength={2000}
          className="form-textarea"
          rows={3}
          placeholder="Optional detail for on-call operators"
        />
      </div>

      <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? "Posting…" : "Post incident banner"}
      </button>
    </form>
  );
}
