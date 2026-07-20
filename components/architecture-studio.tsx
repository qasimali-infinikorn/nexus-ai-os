"use client";

import React, { useState } from "react";
import { Server, Compass, Copy, Check } from "lucide-react";
import Markdown from "./markdown";
import { AgentPanel, RunButton, StatusLine, OutputBlock, statusTone } from "./ui";
import { streamOrchestrate, errorMessage, type AgentPanelProps } from "@/lib/orchestrate-client";

export default function ArchitectureStudio({ provider, model, keys }: AgentPanelProps) {
  const [requirements, setRequirements] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

  const handleDesign = async () => {
    if (!requirements.trim() || loading) return;
    setLoading(true);
    setResult("");
    setStatus("Routing to Principal Architect…");
    setCopied(false);

    try {
      await streamOrchestrate(
        {
          provider,
          model,
          prompt: "Please design a system architecture based on these requirements.",
          agentType: "architecture",
          keys,
          context: requirements
        },
        { onStatus: setStatus, onResult: setResult }
      );
      setStatus("Architecture ready.");
    } catch (error) {
      console.error(error);
      setResult(
        `### Architecture generation failed\n\n${errorMessage(error, "Check your API keys and try again.")}`
      );
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  const mermaidMatch = result.match(/```mermaid([\s\S]*?)```/);
  const mermaidCode = mermaidMatch ? mermaidMatch[1].trim() : null;

  const copyMermaid = async () => {
    if (!mermaidCode) return;
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus("Could not copy — select the code manually.");
    }
  };

  return (
    <AgentPanel
      icon={Server}
      title="System design"
      badge="Architect"
      badgeClass="badge-sky"
    >
      <div className="form-group">
        <label className="form-label" htmlFor="arch-requirements">
          Requirements and workload details
        </label>
        <textarea
          id="arch-requirements"
          className="form-input form-textarea"
          style={{ minHeight: 140 }}
          placeholder="e.g. Real-time notification engine for 10M DAU, sub-100ms latency, HA, event sourcing, cost-efficient on AWS."
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-actions">
        <RunButton
          loading={loading}
          disabled={!requirements.trim()}
          onClick={handleDesign}
          idleLabel="Generate design"
          loadingLabel="Designing…"
        />
        <StatusLine message={status} tone={statusTone(status, loading)} />
      </div>

      {mermaidCode ? (
        <div className="mermaid-extract">
          <div className="mermaid-extract-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Compass size={16} aria-hidden style={{ color: "var(--accent-sky)" }} />
              <h4 style={{ fontSize: "0.95rem" }}>Mermaid diagram</h4>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={copyMermaid}>
              {copied ? (
                <>
                  <Check size={14} aria-hidden style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--accent)" }}>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} aria-hidden />
                  <span>Copy code</span>
                </>
              )}
            </button>
          </div>
          <pre style={{ margin: 0, padding: 12, fontSize: "0.8rem" }}>
            <code>{mermaidCode}</code>
          </pre>
          <p className="mermaid-tip">
            Paste into{" "}
            <a href="https://mermaid.live" target="_blank" rel="noreferrer">
              mermaid.live
            </a>{" "}
            to preview and export SVG/PNG.
          </p>
        </div>
      ) : null}

      {result ? (
        <OutputBlock>
          <Markdown content={result} />
        </OutputBlock>
      ) : null}
    </AgentPanel>
  );
}
