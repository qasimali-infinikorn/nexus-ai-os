"use client";

import React, { useState } from "react";
import { FileText, Download } from "lucide-react";
import Markdown from "./markdown";
import { AgentPanel, RunButton, StatusLine, OutputBlock, statusTone } from "./ui";
import { streamOrchestrate, errorMessage, type AgentPanelProps } from "@/lib/orchestrate-client";

export default function ProposalCreator({ provider, model, keys }: AgentPanelProps) {
  const [problem, setProblem] = useState("");
  const [solutionScope, setSolutionScope] = useState("");
  const [budgetTimeline, setBudgetTimeline] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");

  const handleGenerate = async () => {
    if (!problem.trim() || loading) return;
    setLoading(true);
    setResult("");
    setStatus("Routing to Solution Consultant…");

    const fullDetails = `BUSINESS PROBLEM:\n${problem}\n\nPROPOSED SOLUTION SCOPE:\n${solutionScope}\n\nBUDGET & TIMELINE DETAILS:\n${budgetTimeline}`;

    try {
      await streamOrchestrate(
        {
          provider,
          model,
          prompt: "Please generate a professional executive client proposal.",
          agentType: "proposal",
          keys,
          context: fullDetails
        },
        { onStatus: setStatus, onResult: setResult }
      );
      setStatus("Proposal generated.");
    } catch (error) {
      console.error(error);
      setResult(
        `### Proposal generation failed\n\n${errorMessage(error, "Check your API keys and try again.")}`
      );
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  const downloadProposal = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexus_engineering_proposal.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AgentPanel
      icon={FileText}
      title="Client proposal"
      badge="Consultant"
      badgeClass="badge-green"
    >
      <div className="form-group">
        <label className="form-label" htmlFor="proposal-problem">
          Business problem
        </label>
        <textarea
          id="proposal-problem"
          className="form-input form-textarea"
          style={{ minHeight: 80 }}
          placeholder="e.g. Legacy monolith causes checkout latency and data inconsistency, driving cart abandonment."
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="proposal-scope">
          Solution scope <span className="form-hint">(optional)</span>
        </label>
        <textarea
          id="proposal-scope"
          className="form-input form-textarea"
          style={{ minHeight: 80 }}
          placeholder="e.g. Microservices on GCP with Kubernetes, Redis for catalog cache, RabbitMQ for orders."
          value={solutionScope}
          onChange={(e) => setSolutionScope(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="proposal-budget">
          Budget, constraints & timeline <span className="form-hint">(optional)</span>
        </label>
        <input
          id="proposal-budget"
          type="text"
          className="form-input"
          placeholder="e.g. Budget $150K · Timeline 3 months · Target Q4 2026"
          value={budgetTimeline}
          onChange={(e) => setBudgetTimeline(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-actions">
        <RunButton
          loading={loading}
          disabled={!problem.trim()}
          onClick={handleGenerate}
          idleLabel="Generate proposal"
          loadingLabel="Generating…"
        />
        <StatusLine message={status} tone={statusTone(status, loading)} />
      </div>

      {result ? (
        <OutputBlock
          actions={
            <button type="button" className="btn-secondary btn-sm" onClick={downloadProposal}>
              <Download size={16} aria-hidden />
              <span>Download .md</span>
            </button>
          }
        >
          <Markdown content={result} />
        </OutputBlock>
      ) : null}
    </AgentPanel>
  );
}
