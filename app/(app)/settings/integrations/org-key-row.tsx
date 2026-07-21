"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Trash2 } from "lucide-react";
import { setOrgKeyAction, deleteOrgKeyAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";

export function OrgKeyRow({
  provider,
  label,
  configured,
  updatedAt,
  canEdit
}: {
  provider: string;
  label: string;
  configured: boolean;
  updatedAt: Date | null;
  canEdit: boolean;
}) {
  const [setState, setAction, setPending] = useActionState(setOrgKeyAction, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteOrgKeyAction, undefined);
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontWeight: 600 }}>{label}</p>
          <p className="form-hint">
            {configured
              ? `Configured${updatedAt ? ` · updated ${new Date(updatedAt).toLocaleDateString()}` : ""}`
              : "Not configured"}
          </p>
        </div>
        <span className={`badge ${configured ? "badge-green" : "badge-red"}`}>
          {configured ? <Check size={12} aria-hidden /> : null}
          {configured ? "Active" : "Missing"}
        </span>
      </div>

      {canEdit ? (
        <div style={{ marginTop: 12 }}>
          {setState?.error ? (
            <div className="form-error-banner" role="alert">
              <AlertCircle size={16} aria-hidden />
              <span>{setState.error}</span>
            </div>
          ) : null}
          {setState?.success ? (
            <div className="save-notice">
              <Check size={16} aria-hidden />
              <span>{setState.success}</span>
            </div>
          ) : null}
          {deleteState?.error ? (
            <div className="form-error-banner" role="alert">
              <AlertCircle size={16} aria-hidden />
              <span>{deleteState.error}</span>
            </div>
          ) : null}
          {deleteState?.success ? (
            <div className="save-notice">
              <Check size={16} aria-hidden />
              <span>{deleteState.success}</span>
            </div>
          ) : null}

          {editing || !configured ? (
            <form action={setAction} className="form-row">
              <input type="hidden" name="provider" value={provider} />
              <input
                name="key"
                type="password"
                placeholder={`${label} API key`}
                required
                className="form-input"
                style={{ flex: "1 1 260px" }}
                autoComplete="off"
              />
              <RunButton type="submit" loading={setPending} idleLabel="Save" loadingLabel="Saving…" />
              {configured ? (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              ) : null}
            </form>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
                Replace key
              </button>
              <form action={deleteAction}>
                <input type="hidden" name="provider" value={provider} />
                <button type="submit" className="btn-danger btn-sm" disabled={deletePending}>
                  <Trash2 size={14} aria-hidden />
                  <span>Remove</span>
                </button>
              </form>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
