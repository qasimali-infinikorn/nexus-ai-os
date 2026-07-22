"use client";

import { useActionState, useRef } from "react";
import {
  clearTenantFeatureFlagOverrideAction,
  setTenantFeatureFlagOverrideAction,
  type FlagFormState
} from "@/lib/actions/admin/flags";
import { Toggle } from "@/components/workspace/toggle";
import { Pill } from "@/components/workspace/ui";

export type TenantFlagRow = {
  key: string;
  name: string;
  description: string;
  audience: string;
  effective: boolean;
  override: boolean | null;
  inherited: boolean;
};

function OverrideToggle({
  organizationId,
  flagKey,
  label,
  overrideEnabled
}: {
  organizationId: string;
  flagKey: string;
  label: string;
  overrideEnabled: boolean;
}) {
  const [state, action, pending] = useActionState<FlagFormState, FormData>(
    setTenantFeatureFlagOverrideAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const enabledRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={action} className="row" style={{ gap: 8, alignItems: "center" }}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="key" value={flagKey} />
      <input ref={enabledRef} type="hidden" name="enabled" value={overrideEnabled ? "true" : "false"} />
      <Toggle
        checked={overrideEnabled}
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

function SetOverrideButton({
  organizationId,
  flagKey,
  enabled,
  label
}: {
  organizationId: string;
  flagKey: string;
  enabled: boolean;
  label: string;
}) {
  const [state, action, pending] = useActionState<FlagFormState, FormData>(
    setTenantFeatureFlagOverrideAction,
    undefined
  );
  return (
    <form action={action} className="row" style={{ gap: 6, alignItems: "center" }}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="key" value={flagKey} />
      <input type="hidden" name="enabled" value={enabled ? "true" : "false"} />
      <button
        type="submit"
        className={enabled ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Saving…" : label}
      </button>
      {state?.error ? (
        <span role="alert" className="field-error" style={{ fontSize: "0.75rem" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function ClearOverrideButton({ organizationId, flagKey }: { organizationId: string; flagKey: string }) {
  const [state, action, pending] = useActionState<FlagFormState, FormData>(
    clearTenantFeatureFlagOverrideAction,
    undefined
  );

  return (
    <form action={action} className="row" style={{ gap: 6, alignItems: "center" }}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="key" value={flagKey} />
      <button type="submit" className="btn-ghost btn-sm" disabled={pending} aria-busy={pending}>
        {pending ? "Clearing…" : "Inherit"}
      </button>
      {state?.error ? (
        <span role="alert" className="field-error" style={{ fontSize: "0.75rem" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function TenantFlagOverrides({
  organizationId,
  rows
}: {
  organizationId: string;
  rows: TenantFlagRow[];
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Flag</th>
            <th>Inherited</th>
            <th>Effective</th>
            <th>Override</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <span className="strong">{row.name}</span>
                <span className="meta" style={{ display: "block" }}>
                  {row.key} · {row.audience}
                </span>
              </td>
              <td>
                <Pill tone={row.inherited ? "green" : "slate"}>{row.inherited ? "On" : "Off"}</Pill>
              </td>
              <td>
                <Pill tone={row.effective ? "green" : "slate"}>{row.effective ? "On" : "Off"}</Pill>
              </td>
              <td>
                {row.override === null ? (
                  <span className="dim">Inherit</span>
                ) : (
                  <OverrideToggle
                    organizationId={organizationId}
                    flagKey={row.key}
                    label={`${row.name} override`}
                    overrideEnabled={row.override}
                  />
                )}
              </td>
              <td>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {row.override === null ? (
                    <>
                      <SetOverrideButton
                        organizationId={organizationId}
                        flagKey={row.key}
                        enabled
                        label="Force on"
                      />
                      <SetOverrideButton
                        organizationId={organizationId}
                        flagKey={row.key}
                        enabled={false}
                        label="Force off"
                      />
                    </>
                  ) : (
                    <ClearOverrideButton organizationId={organizationId} flagKey={row.key} />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
