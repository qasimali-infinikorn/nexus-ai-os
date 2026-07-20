"use client";

import React, { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import Markdown from "./markdown";

interface ResearchDigestProps {
  provider: "openai" | "anthropic" | "google";
  model: string;
  keys: { openai?: string; anthropic?: string; google?: string };
}

export default function ResearchDigest({ provider, model, keys }: ResearchDigestProps) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");

  const handleResearch = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setResult("");
    setStatus("CEO routing to Technology Researcher...");

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          prompt: `Research topic: "${topic}". Perform detailed evaluation of trends, pros/cons, community maturity, enterprise readiness, and business value.`,
          agentType: "research",
          keys
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
      setStatus("Research Complete.");
    } catch (error: any) {
      console.error(error);
      setResult(`### Error executing Research\n\n${error.message || "Please check your API keys and try again."}`);
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Search style={{ color: "var(--accent-cyan)" }} />
          <h3>Technology Research & Trends Digest</h3>
        </div>
        <span className="badge badge-purple">Research Agent</span>
      </div>

      <div className="card-body">
        <div className="form-group">
          <label className="form-label">Research Topic or Technology Stack Comparison:</label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              className="form-input"
              style={{ flex: 1 }}
              placeholder="e.g. Next.js App Router vs. Remix for enterprise dashboards, or Qdrant vs. pgvector for local vector search"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && topic.trim()) {
                  handleResearch();
                }
              }}
            />
            <button
              className="btn-primary"
              disabled={loading || !topic.trim()}
              onClick={handleResearch}
              style={{ padding: "0 24px" }}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <span>Search</span>
              )}
            </button>
          </div>
        </div>

        {status && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
            <div className="pulse-indicator" style={{ background: "var(--accent-purple)" }} />
            <span>{status}</span>
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
