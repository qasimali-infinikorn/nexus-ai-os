"use client";

import { useActionState, useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { Toggle } from "@/components/workspace/toggle";
import { RunButton } from "@/components/ui";
import { saveNotificationPrefsAction, type FormState } from "@/lib/actions/settings";
import { NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/workspace/settings-content";

type Prefs = Record<string, { inApp: boolean; email: boolean; slack: boolean }>;

export function NotificationMatrix({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [state, action, pending] = useActionState<FormState, FormData>(saveNotificationPrefsAction, undefined);

  const toggle = (event: string, channel: keyof Prefs[string]) =>
    setPrefs((p) => ({ ...p, [event]: { ...p[event], [channel]: !p[event][channel] } }));

  return (
    <form action={action}>
      <input type="hidden" name="prefs" value={JSON.stringify(prefs)} />

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}
      {state?.success ? (
        <div className="save-notice" role="status">
          <Check size={16} aria-hidden />
          <span>{state.success}</span>
        </div>
      ) : null}

      <div className="table-scroll">
        <table className="data-table matrix-table">
          <thead>
            <tr>
              <th scope="col">Event</th>
              {NOTIFICATION_CHANNELS.map((c) => (
                <th key={c.id} scope="col" style={{ textAlign: "center" }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="strong">{e.label}</span>
                  <span className="meta" style={{ display: "block" }}>
                    {e.detail}
                  </span>
                </td>
                {NOTIFICATION_CHANNELS.map((c) => (
                  <td key={c.id} style={{ textAlign: "center" }}>
                    <Toggle
                      checked={prefs[e.id]?.[c.id] ?? false}
                      onChange={() => toggle(e.id, c.id)}
                      label={`${e.label} via ${c.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <RunButton type="submit" loading={pending} idleLabel="Save preferences" loadingLabel="Saving…" />
      </div>
    </form>
  );
}
