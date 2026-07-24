"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { createOrgApiKeyAction, revokeOrgApiKeyAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";
import { formatRelativeTime } from "@/lib/workspace/admin-ui";

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date | string;
  lastUsedAt: Date | string | null;
  revokedAt: Date | string | null;
};

export function ApiKeysPanel({
  keys,
  canManage
}: {
  keys: ApiKeyRow[];
  canManage: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(createOrgApiKeyAction, undefined);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeOrgApiKeyAction, undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!createState?.plaintextKey) return;
    setCopied(false);
  }, [createState?.plaintextKey]);

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const active = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  return (
    <div className="stack-md">
      <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
        Keys authenticate{" "}
        <code className="mono">/api/knowledge</code> and{" "}
        <code className="mono">/api/orchestrate</code> via{" "}
        <code className="mono">Authorization: Bearer nx_live_…</code>. The full secret is shown once at
        create — only a hash is stored.
      </p>

      {createState?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{createState.error}</span>
        </div>
      ) : null}
      {createState?.success && !createState.plaintextKey ? (
        <div className="save-notice">
          <Check size={16} aria-hidden />
          <span>{createState.success}</span>
        </div>
      ) : null}
      {revokeState?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{revokeState.error}</span>
        </div>
      ) : null}
      {revokeState?.success ? (
        <div className="save-notice">
          <Check size={16} aria-hidden />
          <span>{revokeState.success}</span>
        </div>
      ) : null}

      {createState?.plaintextKey ? (
        <div
          className="stack-md"
          style={{
            padding: 14,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface-2, var(--bg-elevated))"
          }}
        >
          <p className="strong" style={{ margin: 0, fontSize: "0.9rem" }}>
            {createState.success}
          </p>
          <code
            className="mono"
            style={{
              display: "block",
              wordBreak: "break-all",
              fontSize: "0.82rem",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg)"
            }}
          >
            {createState.plaintextKey}
          </code>
          <button type="button" className="btn-secondary btn-sm" onClick={() => copyKey(createState.plaintextKey!)}>
            <Copy size={14} aria-hidden />
            <span>{copied ? "Copied" : "Copy key"}</span>
          </button>
        </div>
      ) : null}

      {canManage ? (
        <form action={createAction} className="form-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: "1 1 220px", marginBottom: 0 }}>
            <label className="form-label" htmlFor="api-key-name">
              Key name
            </label>
            <input
              id="api-key-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="CI pipeline"
              className="form-input"
              autoComplete="off"
            />
          </div>
          <RunButton type="submit" loading={createPending} idleLabel="Generate key" loadingLabel="Generating…" />
        </form>
      ) : (
        <span className="row" style={{ gap: 8 }}>
          <span className="stat-icon violet" style={{ width: 32, height: 32 }}>
            <KeyRound size={15} aria-hidden />
          </span>
          <span className="meta">Only owners and admins can create or revoke API keys.</span>
        </span>
      )}

      {active.length === 0 && revoked.length === 0 ? (
        <p className="dim" style={{ margin: 0 }}>
          No API keys yet.
        </p>
      ) : null}

      {active.length > 0 ? (
        <div className="list" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
          {active.map((key) => (
            <div key={key.id} className="list-row" style={{ gap: 12, flexWrap: "wrap" }}>
              <div className="stack" style={{ flex: 1, minWidth: 160 }}>
                <span className="title">{key.name}</span>
                <span className="meta mono">
                  {key.keyPrefix}… · created {formatRelativeTime(key.createdAt)}
                  {key.lastUsedAt ? ` · last used ${formatRelativeTime(key.lastUsedAt)}` : " · never used"}
                </span>
              </div>
              {canManage ? (
                <form action={revokeAction}>
                  <input type="hidden" name="keyId" value={key.id} />
                  <button
                    type="submit"
                    className="btn-ghost btn-sm"
                    disabled={revokePending}
                    aria-label={`Revoke ${key.name}`}
                  >
                    <Trash2 size={14} aria-hidden />
                    <span>Revoke</span>
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {revoked.length > 0 ? (
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            Revoked
          </span>
          <div className="list" style={{ border: "1px solid var(--border)", borderRadius: 8, opacity: 0.75 }}>
            {revoked.map((key) => (
              <div key={key.id} className="list-row">
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span className="title">{key.name}</span>
                  <span className="meta mono">
                    {key.keyPrefix}… · revoked{" "}
                    {key.revokedAt ? formatRelativeTime(key.revokedAt) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
