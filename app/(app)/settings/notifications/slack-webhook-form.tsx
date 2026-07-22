"use client";

import { useActionState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { RunButton } from "@/components/ui";
import { saveSlackWebhookAction, type FormState } from "@/lib/actions/settings";

export function SlackWebhookForm({ initialUrl }: { initialUrl?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSlackWebhookAction, undefined);

  return (
    <form action={action} className="stack-md">
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

      <div className="form-group">
        <label className="form-label" htmlFor="slack-webhook">
          Slack incoming webhook URL
        </label>
        <input
          id="slack-webhook"
          name="slackWebhookUrl"
          type="url"
          className="form-input"
          defaultValue={initialUrl ?? ""}
          placeholder="https://hooks.slack.com/services/…"
          maxLength={500}
        />
        <span className="form-hint">
          Used when the Slack column is on for an event. Leave blank to disable Slack delivery for your account.
        </span>
      </div>

      <RunButton type="submit" loading={pending} idleLabel="Save Slack webhook" loadingLabel="Saving…" />
    </form>
  );
}
