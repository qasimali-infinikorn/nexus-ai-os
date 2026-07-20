"use client";

import React, { useState } from "react";
import { FileText, Download, Check, Loader2 } from "lucide-react";
import Markdown from "./markdown";

interface ProposalCreatorProps {
  provider: "openai" | "anthropic" | "google";
  model: string;
  keys: { openai?: string; anthropic?: string; google?: string };
}

export default function ProposalCreator({ provider, model, keys }: ProposalCreatorProps) {
  const [problem, setProblem] = useState("");
  const [solutionScope, setSolutionScope] = useState("");
  const [budgetTimeline, setBudgetTimeline] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");

  const handleGenerate = async () => {
    if (!problem.trim()) return;
    setLoading(true);
    setResult("");
    setStatus("CEO routing to Solution Consultant...");

    const fullDetails = `BUSINESS PROBLEM:\n${problem}\n\nPROPOSED SOLUTION SCOPE:\n${solutionScope}\n\nBUDGET & TIMELINE DETAILS:\n${budgetTimeline}`;

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          prompt: "Please generate a professional executive client proposal.",
          agentType: "proposal",
          keys,
          context: fullDetails
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finished = false;
      let buffer = "";
      let accumulatedResult = "";

      while (reader && !finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          buffer += decoder.decode(value, { stream: !finished });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.type === "status") {
                setStatus(data.message);
              } else if (data.type === "agent_result" || data.type === "final_result") {
                accumulatedResult = data.content;
                setResult(accumulatedResult);
              } else if (data.type === "error") {
                throw new Error(data.message);
              }
            } catch (e) {
              // Ignore partial parsing errors
            }
          }
        }
      }
      setStatus("Proposal Generated.");
    } catch (error: any) {
      console.error(error);
      setResult(`### Error generating proposal\n\n${error.message || "Please check your API keys and try again."}`);
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
    <div className="glass-panel">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FileText style={{ color: "var(--accent-cyan)" }} />
          <h3>Enterprise Proposal Generator</h3>
        </div>
        <span className="badge badge-green">Solution Consultant Agent</span>
      </div>

      <div className="card-body">
        <div className="form-group">
          <label className="form-label">Describe the Business Problem:</label>
          <textarea
            className="form-input form-textarea"
            style={{ minHeight: "80px" }}
            placeholder="e.g. Legacy monolith suffers from high latency and data inconsistencies during checkout, leading to cart abandonment and client dissatisfaction."
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Proposed Solution Scope (Optional):</label>
          <textarea
            className="form-input form-textarea"
            style={{ minHeight: "80px" }}
            placeholder="e.g. Migrating to a microservices architecture on Google Cloud using Kubernetes, introducing Redis caching for product catalog, and RabbitMQ for asynchronous order processing."
            value={solutionScope}
            onChange={(e) => setSolutionScope(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Budget, Constraints & Timeline Preferences (Optional):</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Budget: $150K, Timeline: 3 months, Target launch date: Q4 2026."
            value={budgetTimeline}
            onChange={(e) => setBudgetTimeline(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button
            className="btn-primary"
            disabled={loading || !problem.trim()}
            onClick={handleGenerate}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Generating Proposal...</span>
              </>
            ) : (
              <span>Generate Proposal</span>
            )}
          </button>

          {status && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              <div className="pulse-indicator" style={{ background: "var(--accent-green)" }} />
              <span>{status}</span>
            </div>
          )}
        </div>

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={downloadProposal}>
                <Download size={16} />
                <span>Download Proposal (.md)</span>
              </button>
            </div>
            <div className="glass-panel" style={{ padding: "24px", background: "#060913", border: "1px solid var(--border-glass)" }}>
              <Markdown content={result} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
