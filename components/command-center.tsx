"use client";

import React from "react";
import { Terminal, Server, Shield, HelpCircle } from "lucide-react";
import Markdown from "@/components/markdown";
import { StatusLine, RunButton, OutputBlock, statusTone } from "@/components/ui";

type PipelineNode = "ceo_route" | "specialist" | "ceo_synthesis" | null;

export interface CommandCenterProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  loading: boolean;
  status: string;
  result: string;
  activeNode: PipelineNode;
  routedAgent: string | null;
  onRun: () => void;
}

export default function CommandCenter({
  prompt,
  onPromptChange,
  loading,
  status,
  result,
  activeNode,
  routedAgent,
  onRun
}: CommandCenterProps) {
  const tone = statusTone(status, loading);

  return (
    <div className="panel-stack">
      <section className="panel" aria-label="Command console">
        <div className="card-header">
          <div className="card-header-title">
            <Terminal aria-hidden size={18} style={{ color: "var(--accent)" }} />
            <h3>Command console</h3>
          </div>
        </div>

        <div className="card-body">
          <div className="form-group">
            <label className="form-label" htmlFor="ceo-prompt">
              Instruct the coordinator
            </label>
            <div className="form-row">
              <input
                id="ceo-prompt"
                type="text"
                className="form-input"
                style={{ padding: "14px 16px" }}
                placeholder="e.g. Audit my shopping cart component, or draft a DynamoDB → Postgres migration proposal…"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRun();
                }}
                disabled={loading}
              />
              <RunButton
                loading={loading}
                disabled={!prompt.trim()}
                onClick={onRun}
                idleLabel="Run pipeline"
                loadingLabel="Running…"
              />
            </div>
            <p className="form-hint" style={{ marginTop: 4 }}>
              Routes to a specialist, then synthesizes an executive summary.
            </p>
          </div>

          {status ? <StatusLine message={status} tone={tone} /> : null}
        </div>
      </section>

      {loading ? (
        <section className="panel" aria-label="Live agent pipeline" aria-live="polite">
          <div className="card-body">
            <h4
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 14,
                fontWeight: 600
              }}
            >
              Live pipeline
            </h4>
            <div className="pipeline">
              <div
                className={`agent-node ${
                  activeNode === "ceo_route"
                    ? "active"
                    : activeNode
                      ? "completed"
                      : ""
                }`}
              >
                <div className="node-icon">
                  <Terminal size={16} aria-hidden />
                </div>
                <div>
                  <p className="title">Router</p>
                  <p className="sub">Classifying task</p>
                </div>
              </div>

              <div
                className={`pipeline-edge ${
                  activeNode && activeNode !== "ceo_route" ? "lit" : ""
                }`}
                aria-hidden
              />

              <div
                className={`agent-node ${
                  activeNode === "specialist"
                    ? "active"
                    : activeNode === "ceo_synthesis"
                      ? "completed"
                      : ""
                }`}
              >
                <div className="node-icon sky">
                  <Server size={16} aria-hidden />
                </div>
                <div>
                  <p className="title">Specialist</p>
                  <p className="sub" style={{ textTransform: "capitalize" }}>
                    {routedAgent || "Awaiting assignment"}
                  </p>
                </div>
              </div>

              <div
                className={`pipeline-edge ${
                  activeNode === "ceo_synthesis" ? "lit" : ""
                }`}
                aria-hidden
              />

              <div
                className={`agent-node ${
                  activeNode === "ceo_synthesis" ? "active" : ""
                }`}
              >
                <div className="node-icon">
                  <Shield size={16} aria-hidden />
                </div>
                <div>
                  <p className="title">Synthesizer</p>
                  <p className="sub">Aggregating review</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {result ? (
        <OutputBlock title="Executive output" badge="Pipeline complete">
          <Markdown content={result} />
        </OutputBlock>
      ) : null}

      {!result && !loading ? (
        <div className="empty-state">
          <HelpCircle size={40} aria-hidden style={{ strokeWidth: 1.4, opacity: 0.7 }} />
          <h3>Waiting for instruction</h3>
          <p>
            Describe a task above, or open a specialist module from the sidebar.
          </p>
        </div>
      ) : null}
    </div>
  );
}
