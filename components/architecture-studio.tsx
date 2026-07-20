"use client";

import React, { useState } from "react";
import { Server, Compass, Copy, Check, Loader2 } from "lucide-react";
import Markdown from "./markdown";

interface ArchitectureStudioProps {
  provider: "openai" | "anthropic" | "google";
  model: string;
  keys: { openai?: string; anthropic?: string; google?: string };
}

export default function ArchitectureStudio({ provider, model, keys }: ArchitectureStudioProps) {
  const [requirements, setRequirements] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

  const handleDesign = async () => {
    if (!requirements.trim()) return;
    setLoading(true);
    setResult("");
    setStatus("CEO routing to Principal Architect...");
    setCopied(false);

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          prompt: "Please design a system architecture based on these requirements.",
          agentType: "architecture",
          keys,
          context: requirements
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
      setStatus("Architecture Proposal Ready.");
    } catch (error: any) {
      console.error(error);
      setResult(`### Error generating architecture proposal\n\n${error.message || "Please check your API keys and try again."}`);
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract mermaid code block
  const getMermaidCode = () => {
    const match = result.match(/```mermaid([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  };

  const copyMermaid = () => {
    const code = getMermaidCode();
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const mermaidCode = getMermaidCode();

  return (
    <div className="glass-panel">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Server style={{ color: "var(--accent-cyan)" }} />
          <h3>Principal Architecture Studio</h3>
        </div>
        <span className="badge badge-purple">Architect Agent</span>
      </div>

      <div className="card-body">
        <div className="form-group">
          <label className="form-label">System Design Requirements / Workload Details:</label>
          <textarea
            className="form-input form-textarea"
            style={{ minHeight: "140px" }}
            placeholder="Describe your system requirements (e.g. 'Build a real-time notification engine for 10 million daily active users, requiring sub-100ms latency, high availability, event sourcing, and cost-efficient cloud resources on AWS.')"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button
            className="btn-primary"
            disabled={loading || !requirements.trim()}
            onClick={handleDesign}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Generating Architecture...</span>
              </>
            ) : (
              <span>Generate System Design</span>
            )}
          </button>

          {status && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              <div className="pulse-indicator" style={{ background: "var(--accent-purple)" }} />
              <span>{status}</span>
            </div>
          )}
        </div>

        {/* Display Mermaid diagram box if present */}
        {mermaidCode && (
          <div className="glass-panel" style={{ padding: "20px", marginBottom: "25px", border: "1px dashed rgba(0, 243, 255, 0.3)", background: "rgba(0, 243, 255, 0.01)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Compass size={18} style={{ color: "var(--accent-cyan)" }} />
                <h4 style={{ fontSize: "0.95rem" }}>Mermaid.js Flowchart Code</h4>
              </div>
              <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={copyMermaid}>
                {copied ? (
                  <>
                    <Check size={14} style={{ color: "var(--accent-green)" }} />
                    <span style={{ color: "var(--accent-green)" }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Diagram Code</span>
                  </>
                )}
              </button>
            </div>
            <pre style={{ margin: 0, padding: "12px", fontSize: "0.8rem", background: "#05070c !important" }}>
              <code>{mermaidCode}</code>
            </pre>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px" }}>
              💡 Tip: Paste this code directly into <a href="https://mermaid.live" target="_blank" rel="noreferrer" style={{ color: "var(--accent-cyan)" }}>mermaid.live</a> to view, customize, and export high-res visual SVGs/PNGs.
            </p>
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
