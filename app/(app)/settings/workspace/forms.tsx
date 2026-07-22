"use client";

import { useActionState, useState } from "react";
import { Check, AlertCircle, AlertTriangle } from "lucide-react";
import { Toggle } from "@/components/workspace/toggle";
import { RunButton } from "@/components/ui";
import { updateWorkspaceAction, saveAppearanceAction, type FormState } from "@/lib/actions/settings";

function Banners({ state }: { state: FormState }) {
  return (
    <>
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
    </>
  );
}

export function WorkspaceForm({ name, slug, canEdit }: { name: string; slug: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateWorkspaceAction, undefined);

  return (
    <form action={action}>
      <Banners state={state} />

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="ws-name">
            Organization name
          </label>
          <input
            id="ws-name"
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={80}
            className="form-input"
            disabled={!canEdit}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ws-slug">
            Workspace URL
          </label>
          <input id="ws-slug" value={slug} className="form-input" disabled readOnly />
          <span className="form-hint">The slug is fixed once a workspace is created.</span>
        </div>
      </div>

      {canEdit ? (
        <RunButton type="submit" loading={pending} idleLabel="Save changes" loadingLabel="Saving…" />
      ) : (
        <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
          Only owners and admins can rename the workspace.
        </p>
      )}
    </form>
  );
}

export function AppearanceForm({
  reduceMotion,
  comfortableDensity
}: {
  reduceMotion: boolean;
  comfortableDensity: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAppearanceAction, undefined);
  const [motion, setMotion] = useState(reduceMotion);
  const [density, setDensity] = useState(comfortableDensity);

  const rows = [
    {
      key: "reduceMotion",
      label: "Reduce motion",
      detail: "Minimize animations and transitions",
      value: motion,
      set: setMotion
    },
    {
      key: "comfortableDensity",
      label: "Comfortable density",
      detail: "More padding across the app",
      value: density,
      set: setDensity
    }
  ];

  return (
    <form action={action}>
      <Banners state={state} />

      {rows.map((r) => (
        <div key={r.key} className="row-between" style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
          <div className="stack">
            <span className="strong">{r.label}</span>
            <span className="meta">{r.detail}</span>
          </div>
          <Toggle checked={r.value} onChange={r.set} label={r.label} name={r.key} />
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <RunButton type="submit" loading={pending} idleLabel="Save appearance" loadingLabel="Saving…" />
      </div>
    </form>
  );
}

/**
 * Destructive action gated behind typing the workspace name, per the
 * "confirm before irreversible actions" guideline — a plain confirm() is too
 * easy to click through for something that deletes everything.
 */
export function DangerZone({ canEdit, orgName }: { canEdit: boolean; orgName: string }) {
  const [confirmText, setConfirmText] = useState("");
  const armed = confirmText.trim() === orgName;

  return (
    <section className="card danger-card">
      <div className="card-head bordered">
        <div className="stack">
          <h3 className="card-title" style={{ color: "var(--accent-red)" }}>
            <span className="row" style={{ gap: 8 }}>
              <AlertTriangle size={16} aria-hidden />
              Danger zone
            </span>
          </h3>
          <p className="card-sub">
            Deleting the workspace removes all projects, proposals, and agent history. This cannot be undone.
          </p>
        </div>
      </div>

      <div className="card-pad stack-md">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="confirm-delete">
            Type <strong>{orgName}</strong> to confirm
          </label>
          <input
            id="confirm-delete"
            className="form-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={orgName}
            disabled={!canEdit}
            autoComplete="off"
          />
        </div>

        <button
          type="button"
          className="btn-danger"
          disabled={!canEdit || !armed}
          style={{ alignSelf: "flex-start" }}
          title={!canEdit ? "Only owners and admins can delete a workspace" : undefined}
        >
          Delete workspace
        </button>

        <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
          Deletion isn&rsquo;t wired up yet — the button stays disabled rather than pretending to work.
        </p>
      </div>
    </section>
  );
}
