"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import {
  linkTenantStripeCustomerAction,
  type AdminFormState
} from "@/lib/actions/admin/tenants";

export function LinkStripeCustomerForm({
  organizationId,
  initialCustomerId
}: {
  organizationId: string;
  initialCustomerId?: string | null;
}) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(
    linkTenantStripeCustomerAction,
    undefined
  );

  return (
    <form action={action} className="stack-md" style={{ padding: "0 1.25rem 1.25rem" }}>
      <input type="hidden" name="organizationId" value={organizationId} />
      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}
      {state?.success ? (
        <p className="meta" role="status" style={{ color: "var(--accent-green, #059669)" }}>
          {state.success}
        </p>
      ) : null}
      <div className="form-group">
        <label className="form-label" htmlFor="stripe-customer-id">
          Stripe customer id
        </label>
        <input
          id="stripe-customer-id"
          name="stripeCustomerId"
          className="form-input"
          defaultValue={initialCustomerId ?? ""}
          placeholder="cus_…"
          maxLength={120}
        />
        <span className="form-hint">
          Optional if Customer metadata already has <code>organizationId</code>. Clear the field to unlink.
        </span>
      </div>
      <button type="submit" className="btn-secondary btn-sm" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save Stripe link"}
      </button>
    </form>
  );
}
