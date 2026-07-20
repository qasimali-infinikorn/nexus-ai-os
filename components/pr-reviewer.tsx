"use client";

import React, { useState } from "react";
import { FileCode, ShieldAlert, Award, TrendingUp, Cpu, Loader2 } from "lucide-react";
import Markdown from "./markdown";

interface PRReviewerProps {
  provider: "openai" | "anthropic" | "google";
  model: string;
  keys: { openai?: string; anthropic?: string; google?: string };
}

export default function PRReviewer({ provider, model, keys }: PRReviewerProps) {
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [techDebt, setTechDebt] = useState<string | null>(null);

  const handleReview = async () => {
    if (!diff.trim()) return;
    setLoading(true);
    setResult("");
    setStatus("CEO routing to Engineering Lead...");
    setScore(null);
    setTechDebt(null);

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          prompt: "Please review this code change or pull request.",
          agentType: "eng_lead",
          keys,
          context: diff
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
          // Save the last partial line back to the buffer
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

                // Try to parse score and technical debt on-the-fly or at the end
                const scoreMatch = accumulatedResult.match(/(?:Overall Score|Score):\s*(\d+)/i);
                if (scoreMatch) {
                  setScore(parseInt(scoreMatch[1], 10));
                }

                const debtMatch = accumulatedResult.match(/(?:Estimated Technical Debt|Technical Debt):\s*(.*)/i);
                if (debtMatch) {
                  setTechDebt(debtMatch[1].trim());
                }
              } else if (data.type === "error") {
                throw new Error(data.message);
              }
            } catch (e) {
              // Ignore line parsing error for incomplete chunks
            }
          }
        }
      }
      setStatus("Review Complete.");
    } catch (error: any) {
      console.error(error);
      setResult(`### Error executing PR Review\n\n${error.message || "Please check your API keys and try again."}`);
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FileCode style={{ color: "var(--accent-cyan)" }} />
          <h3>Pull Request & Code Quality Reviewer</h3>
        </div>
        <span className="badge badge-cyan">Eng Lead Agent</span>
      </div>

      <div className="card-body">
        <div className="form-group">
          <label className="form-label">Paste Git Diff, Pull Request contents, or Source Code:</label>
          <textarea
            className="form-input form-textarea"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", minHeight: "200px" }}
            placeholder="diff --git a/src/index.ts b/src/index.ts&#10;index 83a2b7c..d92c81e 100644&#10;--- a/src/index.ts&#10;+++ b/src/index.ts&#10;@@ -1,5 +1,6 @@&#10;+ // Add optimized function"
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button
            className="btn-primary"
            disabled={loading || !diff.trim()}
            onClick={handleReview}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Reviewing Code...</span>
              </>
            ) : (
              <span>Start Code Review</span>
            )}
          </button>

          {status && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              <div className="pulse-indicator" />
              <span>{status}</span>
            </div>
          )}
        </div>

        {/* Scorecards */}
        {(score !== null || techDebt !== null) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "30px" }}>
            {score !== null && (
              <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "20px", background: "rgba(255, 255, 255, 0.02)" }}>
                <div className={`score-badge ${score >= 80 ? "high" : score >= 60 ? "medium" : "low"}`}>
                  {score}
                </div>
                <div>
                  <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Quality Score</h4>
                  <p style={{ fontWeight: 600, fontSize: "1.1rem" }}>
                    {score >= 80 ? "Excellent Quality" : score >= 60 ? "Technical Debt Warnings" : "Needs Immediate Refactoring"}
                  </p>
                </div>
              </div>
            )}

            {techDebt && (
              <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "20px", background: "rgba(255, 255, 255, 0.02)" }}>
                <div style={{ padding: "12px", borderRadius: "50%", background: "rgba(189, 92, 255, 0.1)", color: "var(--accent-purple)" }}>
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Estimated Tech Debt</h4>
                  <p style={{ fontWeight: 600, fontSize: "1.1rem", color: "var(--accent-purple)" }}>{techDebt}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="glass-panel" style={{ padding: "24px", background: "#060913", border: "1px solid var(--border-glass)" }}>
            <Markdown content={result} />
          </div>
        )}
      </div>
    </div>
  );
}
