"use client";

import { useActionState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { changePasswordAction, revokeOtherSessionsAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { securityControls } from "@/lib/workspace/settings-content";

export default function SecuritySettingsPage() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeOtherSessionsAction, undefined);

  return (
    <div className="stack-lg">
      <Card>
        <CardHead title="Password" sub="Change the password for this account" bordered />
        <div className="card-pad">
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
      </Card>

      <Card>
        <CardHead title="Sessions" sub="Sign out other browsers" bordered />
        <div className="card-pad stack-md">
          <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
            Sessions are JWTs. “Sign out everywhere else” bumps a server-side version so other tokens stop
            working on their next refresh — this browser stays signed in.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <Pill tone="green">This browser</Pill>
            <span className="meta">Use Sign out in the sidebar to end this session only.</span>
          </div>
          {revokeState?.error ? (
            <div className="form-error-banner" role="alert">
              <AlertCircle size={16} aria-hidden />
              <span>{revokeState.error}</span>
            </div>
          ) : null}
          {revokeState?.success ? (
            <div className="save-notice" role="status">
              <Check size={16} aria-hidden />
              <span>{revokeState.success}</span>
            </div>
          ) : null}
          <form action={revokeAction}>
            <RunButton
              type="submit"
              loading={revokePending}
              idleLabel="Sign out everywhere else"
              loadingLabel="Revoking…"
            />
          </form>
        </div>
      </Card>

      <Card>
        <CardHead title="Planned controls" sub="Not live yet — listed so the page stays honest" bordered />
        <div className="list">
          {securityControls.map((c) => (
            <div key={c.id} className="list-row">
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="title">{c.label}</span>
                <span className="meta">{c.detail}</span>
              </div>
              <Pill tone="slate">Coming soon</Pill>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
