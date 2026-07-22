"use client";

import { useActionState } from "react";
import { setTenantStatusAction, type AdminFormState } from "@/lib/actions/admin/tenants";

export function TenantStatusForm({
  organizationId,
  suspended
}: {
  organizationId: string;
  suspended: boolean;
}) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(setTenantStatusAction, undefined);

  return (
    <form action={action} className="row" style={{ gap: 6, alignItems: "center" }}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="intent" value={suspended ? "restore" : "suspend"} />
      <button
        type="submit"
        className={suspended ? "btn-secondary" : "btn-ghost"}
        disabled={pending}
        style={{ fontSize: "0.8rem", padding: "6px 10px" }}
      >
        {pending ? "…" : suspended ? "Restore" : "Suspend"}
      </button>
      {state?.error ? (
        <span role="alert" className="field-error" style={{ fontSize: "0.75rem" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
