"use client";

import { useActionState } from "react";
import { setFeatureFlagAudienceAction, type FlagFormState } from "@/lib/actions/admin/flags";
import { FEATURE_FLAG_AUDIENCES, type FeatureFlagAudience } from "@/lib/db/schema";

const AUDIENCE_LABELS: Record<FeatureFlagAudience, string> = {
  all: "All tenants",
  business_plus: "Business+",
  enterprise: "Enterprise",
  opt_in: "Opt-in only",
  tenant_list: "Tenant list"
};

export function FlagAudienceSelect({
  flagKey,
  audience
}: {
  flagKey: string;
  audience: FeatureFlagAudience;
}) {
  const [state, action, pending] = useActionState<FlagFormState, FormData>(
    setFeatureFlagAudienceAction,
    undefined
  );

  return (
    <form action={action} className="row" style={{ gap: 6, alignItems: "center" }}>
      <input type="hidden" name="key" value={flagKey} />
      <select
        name="audience"
        className="form-select"
        defaultValue={audience}
        disabled={pending}
        style={{ padding: "6px 10px", fontSize: "0.8rem", width: "auto" }}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {FEATURE_FLAG_AUDIENCES.map((value) => (
          <option key={value} value={value}>
            {AUDIENCE_LABELS[value]}
          </option>
        ))}
      </select>
      {state?.error ? (
        <span role="alert" className="field-error" style={{ fontSize: "0.75rem" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
