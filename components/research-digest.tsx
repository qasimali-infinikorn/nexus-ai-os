"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import Markdown from "./markdown";
import { AgentPanel, RunButton, StatusLine, OutputBlock, statusTone } from "./ui";
import { streamOrchestrate, errorMessage, type AgentPanelProps } from "@/lib/orchestrate-client";

export default function ResearchDigest({ provider, model, keys }: AgentPanelProps) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");

  const handleResearch = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setResult("");
    setStatus("Routing to Technology Researcher…");

    try {
      await streamOrchestrate(
        {
          provider,
          model,
          prompt: `Research topic: "${topic}". Perform detailed evaluation of trends, pros/cons, community maturity, enterprise readiness, and business value.`,
          agentType: "research",
          keys
        },
        { onStatus: setStatus, onResult: setResult }
      );
      setStatus("Research complete.");
    } catch (error) {
      console.error(error);
      setResult(
        `### Research failed\n\n${errorMessage(error, "Check your API keys and try again.")}`
      );
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AgentPanel icon={Search} title="Technology research" badge="Research" badgeClass="badge-sky">
      <div className="form-group">
        <label className="form-label" htmlFor="research-topic">
          Topic or stack comparison
        </label>
        <div className="form-row">
          <input
            id="research-topic"
            type="text"
            className="form-input"
            placeholder="e.g. Next.js App Router vs Remix, or Qdrant vs pgvector"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleResearch();
            }}
            disabled={loading}
          />
          <RunButton
            loading={loading}
            disabled={!topic.trim()}
            onClick={handleResearch}
            idleLabel="Research"
            loadingLabel="Researching…"
          />
        </div>
      </div>

      {status ? <StatusLine message={status} tone={statusTone(status, loading)} /> : null}

      {result ? (
        <div style={{ marginTop: status ? 20 : 0 }}>
          <OutputBlock>
            <Markdown content={result} />
          </OutputBlock>
        </div>
      ) : null}
    </AgentPanel>
  );
}
