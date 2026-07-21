"use client";

import { useActionState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { updateProfileAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";

export function ProfileForm({ name, email, orgName }: { name: string; email: string; orgName: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, undefined);

  return (
    <form action={action}>
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

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" defaultValue={name} required className="form-input" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <input id="email" value={email} disabled className="form-input" />
          <span className="form-hint">Email changes aren&rsquo;t supported yet.</span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="org">
            Organization
          </label>
          <input id="org" value={orgName} disabled className="form-input" />
        </div>
      </div>

      <RunButton type="submit" loading={pending} idleLabel="Save changes" loadingLabel="Saving…" />
    </form>
  );
}
