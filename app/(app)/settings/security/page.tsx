"use client";

import { useActionState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { changePasswordAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { securityControls } from "@/lib/workspace/settings-content";

export default function SecuritySettingsPage() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);

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
        <CardHead title="Sessions" sub="How sign-in works today" bordered />
        <div className="card-pad stack-md">
          <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
            Sessions are stateless JWTs — there is no server-side device list to show or revoke. This browser
            stays signed in until the token expires or you sign out. Remote revoke needs a session store (see{" "}
            <code>docs/AUTH.md</code>).
          </p>
          <div className="row" style={{ gap: 8 }}>
            <Pill tone="green">This browser</Pill>
            <span className="meta">Use Sign out in the sidebar to end this session.</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Planned controls" sub="Organization policy — not enforced yet" bordered />
        <div className="card-pad">
          <p className="dim" style={{ margin: "0 0 12px", lineHeight: 1.55 }}>
            These are roadmap items. Toggles are not live — nothing here changes sign-in behavior today.
          </p>
          <div>
            {securityControls.map((c) => (
              <div
                key={c.id}
                className="row-between"
                style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}
              >
                <div className="stack">
                  <span className="strong">{c.label}</span>
                  <span className="meta">{c.detail}</span>
                </div>
                <Pill tone="slate">Coming soon</Pill>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
