"use client";

import { useActionState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { changePasswordAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";

export default function SecuritySettingsPage() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);

  return (
    <div className="panel">
      <div className="card-header">
        <div className="card-header-title">
          <h3>Password</h3>
        </div>
      </div>
      <div className="card-body">
        {state?.error ? (
          <div className="form-error-banner" role="alert">
            <AlertCircle size={16} aria-hidden />
            <span>{state.error}</span>
          </div>
        ) : null}
        {state?.success ? (
          <div className="save-notice">
            <Check size={16} aria-hidden />
            <span>{state.success}</span>
          </div>
        ) : null}

        <form action={action}>
          <div className="form-group">
            <label className="form-label" htmlFor="currentPassword">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="form-input"
            />
            <span className="form-hint">At least 8 characters, with a letter and a number.</span>
          </div>
          <RunButton type="submit" loading={pending} idleLabel="Update password" loadingLabel="Updating…" />
        </form>
      </div>
    </div>
  );
}
