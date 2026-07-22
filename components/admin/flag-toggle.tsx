"use client";

import { useActionState, useEffect, useRef } from "react";
import { toggleFeatureFlagAction, type FlagFormState } from "@/lib/actions/admin/flags";
import { Toggle } from "@/components/workspace/toggle";

/**
 * Optimistic switch that posts the next enabled value via a server action.
 * The hidden `enabled` field is updated before submit so the action sees the intent.
 */
export function FlagToggle({
  flagKey,
  enabled,
  label
}: {
  flagKey: string;
  enabled: boolean;
  label: string;
}) {
  const [state, action, pending] = useActionState<FlagFormState, FormData>(toggleFeatureFlagAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const enabledRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // no-op: parent RSC re-renders after successful toggle via revalidatePath
  }, [state]);

  return (
    <form ref={formRef} action={action} className="row" style={{ gap: 8, alignItems: "center" }}>
      <input type="hidden" name="key" value={flagKey} />
      <input ref={enabledRef} type="hidden" name="enabled" value={enabled ? "true" : "false"} />
      <Toggle
        checked={enabled}
        label={label}
        disabled={pending}
        onChange={(next) => {
          if (enabledRef.current) enabledRef.current.value = next ? "true" : "false";
          formRef.current?.requestSubmit();
        }}
      />
      {state?.error ? (
        <span role="alert" className="field-error" style={{ fontSize: "0.75rem" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
