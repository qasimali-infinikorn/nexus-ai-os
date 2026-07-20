"use client";

import React, { useState } from "react";
import { FileCode, TrendingUp } from "lucide-react";
import Markdown from "./markdown";
import { AgentPanel, RunButton, StatusLine, OutputBlock, statusTone } from "./ui";
import { streamOrchestrate, errorMessage, type AgentPanelProps } from "@/lib/orchestrate-client";

export default function PRReviewer({ provider, model, keys }: AgentPanelProps) {
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [techDebt, setTechDebt] = useState<string | null>(null);

  const handleReview = async () => {
    if (!diff.trim() || loading) return;
    setLoading(true);
    setResult("");
    setStatus("Routing to Engineering Lead…");
    setScore(null);
    setTechDebt(null);

    try {
      await streamOrchestrate(
        {
          provider,
          model,
          prompt: "Please review this code change or pull request.",
          agentType: "eng_lead",
          keys,
          context: diff
        },
        {
          onStatus: setStatus,
          onResult: (content) => {
            setResult(content);

            const scoreMatch = content.match(/(?:Overall Score|Score):\s*(\d+)/i);
            if (scoreMatch) setScore(parseInt(scoreMatch[1], 10));

            const debtMatch = content.match(/(?:Estimated Technical Debt|Technical Debt):\s*(.*)/i);
            if (debtMatch) setTechDebt(debtMatch[1].trim());
          }
        }
      );
      setStatus("Review complete.");
    } catch (error) {
      console.error(error);
      setResult(
        `### Review failed\n\n${errorMessage(error, "Check your API keys and try again.")}`
      );
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AgentPanel icon={FileCode} title="Code quality review" badge="Eng Lead" badgeClass="badge-sky">
      <div className="form-group">
        <label className="form-label" htmlFor="pr-diff">
          Paste a git diff, PR contents, or source
        </label>
        <textarea
          id="pr-diff"
          className="form-input form-textarea form-mono"
          style={{ minHeight: 200 }}
          placeholder={"diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,5 +1,6 @@\n+// optimized path"}
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-actions">
        <RunButton
          loading={loading}
          disabled={!diff.trim()}
          onClick={handleReview}
          idleLabel="Start review"
          loadingLabel="Reviewing…"
        />
        <StatusLine message={status} tone={statusTone(status, loading)} />
      </div>

      {(score !== null || techDebt !== null) && (
        <div className="metric-cards">
          {score !== null && (
            <div className="metric-card">
              <div className={`score-badge ${score >= 80 ? "high" : score >= 60 ? "medium" : "low"}`}>
                {score}
              </div>
              <div>
                <h4>Quality score</h4>
                <p>
                  {score >= 80
                    ? "Strong"
                    : score >= 60
                      ? "Needs attention"
                      : "Refactor soon"}
                </p>
              </div>
            </div>
          )}

          {techDebt && (
            <div className="metric-card">
              <div
                style={{
                  padding: 12,
                  borderRadius: "50%",
                  background: "var(--accent-sky-muted)",
                  color: "var(--accent-sky)",
                  flexShrink: 0
                }}
              >
                <TrendingUp size={22} aria-hidden />
              </div>
              <div>
                <h4>Estimated tech debt</h4>
                <p style={{ color: "var(--accent-sky)" }}>{techDebt}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {result ? (
        <OutputBlock>
          <Markdown content={result} />
        </OutputBlock>
      ) : null}
    </AgentPanel>
  );
}
