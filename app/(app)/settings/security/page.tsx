"use client";

import { useActionState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { changePasswordAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";
import { Card, CardHead, Pill, DemoNotice } from "@/components/workspace/ui";
import { Toggle } from "@/components/workspace/toggle";
import { securityControls, activeSessions } from "@/lib/workspace/settings-content";

export default function SecuritySettingsPage() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);

  return (
    <div className="stack-lg">
      <Card>
        <CardHead title="Authentication" sub="Organization-wide sign-in requirements" bordered />
        <div className="card-pad">
          <DemoNotice>
            These enforcement controls aren&rsquo;t implemented yet, so they&rsquo;re shown read-only rather than
            toggling something that wouldn&rsquo;t take effect.
          </DemoNotice>
          <div style={{ marginTop: 14 }}>
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
                <Toggle checked={c.on} label={c.label} disabled />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Active sessions" sub="Devices signed in to your account" bordered />
        <div className="card-pad">
          <DemoNotice>
            Sessions are stateless JWTs today, so there is no server-side list to revoke from. Real session
            management needs a session store — see docs/AUTH.md.
          </DemoNotice>
          <div style={{ marginTop: 6 }}>
            {activeSessions.map((sess) => (
              <div key={sess.id} className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <div className="stack" style={{ flex: 1 }}>
                  <span className="title">{sess.device}</span>
                  <span className="meta">{sess.where}</span>
                </div>
                {sess.current ? (
                  <Pill tone="green">This device</Pill>
                ) : (
                  <button type="button" className="btn-secondary btn-sm" disabled>
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

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
    </div>
  );
}
