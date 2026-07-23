"use client";

import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import Markdown from "./markdown";
import { AgentPanel, RunButton, StatusLine, OutputBlock, statusTone } from "./ui";
import { streamOrchestrate, errorMessage, type AgentPanelProps } from "@/lib/orchestrate-client";

const DOC_TYPES = [
  { value: "README", label: "README" },
  { value: "ADR", label: "Architecture Decision Record (ADR)" },
  { value: "API", label: "API documentation" },
  { value: "Runbook", label: "Runbook / ops guide" },
  { value: "Onboarding", label: "Onboarding guide" },
  { value: "Design", label: "Design document" },
  { value: "Confluence", label: "Confluence / wiki page" }
] as const;

export default function DocumentationStudio({ provider, model, keys }: AgentPanelProps) {
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]["value"]>("README");
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");

  const handleGenerate = async () => {
    if (!subject.trim() || loading) return;
    setLoading(true);
    setResult("");
    setStatus("Routing to Doc Architect…");

    const prompt = `Generate a production-grade ${docType} for: "${subject.trim()}".`;
    const extra = context.trim()
      ? `Additional context / source material:\n${context.trim()}`
      : undefined;

    try {
      await streamOrchestrate(
        {
          provider,
          model,
          prompt,
          agentType: "documentation",
          keys,
          context: extra
        },
        { onStatus: setStatus, onResult: setResult }
      );
      setStatus("Documentation ready.");
    } catch (error) {
      console.error(error);
      setResult(
        `### Documentation generation failed\n\n${errorMessage(error, "Check your API keys and try again.")}`
      );
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AgentPanel icon={BookOpen} title="Documentation" badge="Docs" badgeClass="badge-green">
      <div className="form-group">
        <label className="form-label" htmlFor="doc-type">
          Document type
        </label>
        <select
          id="doc-type"
          className="form-select"
          value={docType}
          onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPES)[number]["value"])}
          disabled={loading}
        >
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="doc-subject">
          Subject
        </label>
        <input
          id="doc-subject"
          type="text"
          className="form-input"
          placeholder="e.g. payments-api service, webhook retry ADR, on-call runbook for checkout"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleGenerate();
          }}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="doc-context">
          Context (optional)
        </label>
        <textarea
          id="doc-context"
          className="form-input form-textarea"
          style={{ minHeight: 120 }}
          placeholder="Paste relevant code, OpenAPI snippets, existing notes, or constraints the Doc Architect should honor."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-actions">
        <RunButton
          loading={loading}
          disabled={!subject.trim()}
          onClick={handleGenerate}
          idleLabel="Generate docs"
          loadingLabel="Writing…"
        />
        <StatusLine message={status} tone={statusTone(status, loading)} />
      </div>

      {result ? (
        <OutputBlock>
          <Markdown content={result} />
        </OutputBlock>
      ) : null}
    </AgentPanel>
  );
}
