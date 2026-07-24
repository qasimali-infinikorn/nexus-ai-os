"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { openBillingPortalAction } from "@/lib/actions/settings";
import { RunButton } from "@/components/ui";

export function BillingPortalButton({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(openBillingPortalAction, undefined);

  useEffect(() => {
    if (state?.portalUrl) {
      window.location.assign(state.portalUrl);
    }
  }, [state?.portalUrl]);

  if (!enabled) {
    return (
      <button type="button" className="btn-secondary" disabled title="Link a Stripe customer first">
        Manage billing
      </button>
    );
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}
      <form action={action}>
        <RunButton type="submit" loading={pending} idleLabel="Manage billing" loadingLabel="Opening…" />
      </form>
    </div>
  );
}
