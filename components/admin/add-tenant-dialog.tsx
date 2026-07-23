"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import { createTenantAction, type AdminFormState } from "@/lib/actions/admin/tenants";
import { ORGANIZATION_PLAN_TIERS } from "@/lib/db/schema";
import { PLAN_LABELS } from "@/lib/workspace/admin-ui";

export function AddTenantDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createTenantAction, undefined);
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden />
        <span>Add tenant</span>
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
            Add tenant
          </h2>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close dialog">
            <X size={16} aria-hidden />
          </button>
        </div>

        <p className="dim" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
          Creates an organization and emails an owner invite when Resend is configured
          (<code>RESEND_API_KEY</code> + <code>EMAIL_FROM</code>). The invite path is always shown as a fallback.
        </p>

        {state?.error ? (
          <div className="form-error-banner" role="alert">
            <AlertCircle size={16} aria-hidden />
            <span>{state.error}</span>
          </div>
        ) : null}

        {state?.success ? (
          <div className="form-error-banner" role="status" style={{ borderColor: "var(--accent-green)", color: "var(--text-primary)" }}>
            <span>
              {state.success}
              {state.invitePath ? (
                <>
                  {" "}
                  Invite path: <code>{state.invitePath}</code>
                </>
              ) : null}
            </span>
          </div>
        ) : null}

        <form action={action}>
          <div className="form-group">
            <label className="form-label" htmlFor="tenant-name">
              Organization name
            </label>
            <input
              id="tenant-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              className="form-input"
              disabled={pending}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="tenant-owner">
              Owner email
            </label>
            <input
              id="tenant-owner"
              name="ownerEmail"
              type="email"
              required
              className="form-input"
              disabled={pending}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="tenant-plan">
              Plan
            </label>
            <select
              id="tenant-plan"
              name="planTier"
              className="form-select"
              defaultValue="trial"
              disabled={pending}
            >
              {ORGANIZATION_PLAN_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {PLAN_LABELS[tier]}
                </option>
              ))}
            </select>
          </div>

          <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
              Close
            </button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Creating…" : "Create tenant"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
