"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Copy } from "lucide-react";
import { inviteTeammateAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteTeammateAction, undefined);
  const [copied, setCopied] = useState(false);

  const fullInviteUrl =
    state?.inviteUrl && typeof window !== "undefined" ? `${window.location.origin}${state.inviteUrl}` : state?.inviteUrl;

  return (
    <form action={action}>
      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      {state?.success && fullInviteUrl ? (
        <div className="save-notice" style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <Check size={16} aria-hidden />
          <span>Invite created — no email is sent yet, share this link directly:</span>
          <code style={{ wordBreak: "break-all" }}>{fullInviteUrl}</code>
          <button
            type="button"
            className="icon-btn"
            aria-label="Copy invite link"
            onClick={() => {
              navigator.clipboard.writeText(fullInviteUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Copy size={14} aria-hidden />
          </button>
          {copied ? <span className="form-hint">Copied.</span> : null}
        </div>
      ) : null}

      <div className="form-row">
        <input
          name="email"
          type="email"
          required
          placeholder="teammate@company.com"
          className="form-input"
          style={{ flex: "1 1 240px" }}
        />
        <select name="role" className="form-select" defaultValue="member" style={{ maxWidth: 140 }}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <RunButton type="submit" loading={pending} idleLabel="Send invite" loadingLabel="Creating…" />
      </div>
    </form>
  );
}
