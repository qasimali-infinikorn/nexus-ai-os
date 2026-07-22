"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { createCustomAgentAction, type CustomAgentFormState } from "@/lib/actions/custom-agents";

export function NewCustomAgentForm() {
  const [state, action, pending] = useActionState<CustomAgentFormState, FormData>(
    createCustomAgentAction,
    undefined
  );

  return (
    <form action={action} className="card card-pad stack-md">
      <div className="stack" style={{ gap: 4 }}>
        <h3 className="card-title" style={{ fontSize: "1rem" }}>
          New custom agent
        </h3>
        <p className="card-sub">Org-scoped specialist with your own system prompt. Admins only.</p>
      </div>

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

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="agent-name">
            Name
          </label>
          <input
            id="agent-name"
            name="name"
            required
            minLength={2}
            maxLength={60}
            className="form-input"
            placeholder="Security reviewer"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="agent-accent">
            Accent
          </label>
          <select id="agent-accent" name="accent" className="form-select" defaultValue="violet">
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="amber">Amber</option>
            <option value="red">Red</option>
            <option value="violet">Violet</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="agent-desc">
          Description
        </label>
        <input
          id="agent-desc"
          name="description"
          required
          minLength={8}
          maxLength={280}
          className="form-input"
          placeholder="Reviews diffs for OWASP issues and secrets."
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="agent-prompt">
          System prompt
        </label>
        <textarea
          id="agent-prompt"
          name="systemPrompt"
          required
          minLength={40}
          maxLength={20_000}
          className="form-textarea"
          rows={6}
          placeholder="You are a security specialist. Focus on…"
        />
      </div>

      <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? "Creating…" : "Create agent"}
      </button>
    </form>
  );
}
