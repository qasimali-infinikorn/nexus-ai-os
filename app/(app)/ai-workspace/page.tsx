"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Play, Copy, Download, Share2, BookmarkPlus, Clock, Plus, X, Loader2 } from "lucide-react";
import Markdown from "@/components/markdown";
import { PageHeader } from "@/components/app-shell/page-header";
import { useProviderPreference } from "@/components/app-shell/provider-preference";
import { ProviderModelPicker } from "@/components/app-shell/provider-model-picker";
import { Card, CardHead } from "@/components/workspace/ui";
import { StatusLine, statusTone } from "@/components/ui";
import { streamOrchestrate, errorMessage } from "@/lib/orchestrate-client";
import { suggestedPrompts, workspaceHistory, workspaceContextChips, agents } from "@/lib/workspace/content";

const RUNNABLE = agents.filter((a) => a.agentType);

export default function AIWorkspacePage() {
  const searchParams = useSearchParams();
  const { provider, model, setProvider, setModel } = useProviderPreference();

  const [agentType, setAgentType] = useState("coordinator");
  const [prompt, setPrompt] = useState(() => searchParams.get("q")?.trim() ?? "");
  const [chips, setChips] = useState<string[]>(workspaceContextChips);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResult("");
    setStatus("Initializing pipeline…");
    try {
      await streamOrchestrate(
        { provider, model, prompt, agentType, keys: {} },
        { onStatus: setStatus, onResult: setResult }
      );
      setStatus("Completed.");
    } catch (error) {
      console.error(error);
      setResult(
        `### Run failed\n\n${errorMessage(error, "Something went wrong. Check that an org provider key is configured under Settings → Integrations.")}`
      );
      setStatus("Error.");
    } finally {
      setLoading(false);
    }
  };

  const activeAgentName =
    agentType === "coordinator" ? "Coordinator" : RUNNABLE.find((a) => a.agentType === agentType)?.name ?? "Agent";

  return (
    <>
      <PageHeader
        title="AI Workspace"
        description="Compose, run, and iterate with your engineering agents."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <span className="status-dot active" aria-hidden />
            <select
              className="form-select"
              style={{ minWidth: 240 }}
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              aria-label="Agent"
            >
              <option value="coordinator">Coordinator (auto-route)</option>
              {RUNNABLE.map((a) => (
                <option key={a.id} value={a.agentType}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="with-rail paneled">
        <div className="stack-lg">
          <ProviderModelPicker
            provider={provider}
            model={model}
            onProviderChange={setProvider}
            onModelChange={setModel}
          />

          <Card>
            <div className="card-pad stack-md">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {chips.map((c) => (
                  <span key={c} className="chip">
                    {c}
                    <button
                      type="button"
                      onClick={() => setChips((prev) => prev.filter((x) => x !== c))}
                      aria-label={`Remove ${c} from context`}
                      style={{ background: "none", border: "none", padding: 0, display: "flex", color: "inherit" }}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ))}
                <span className="chip chip-dashed">
                  <Plus size={12} aria-hidden />
                  Add context
                </span>
              </div>

              <textarea
                className="form-textarea"
                style={{ minHeight: 150, fontSize: "0.95rem", border: "none", background: "transparent", padding: 0 }}
                placeholder="Draft an ADR comparing event-driven vs. request/response for the new inventory sync, with tradeoffs, a recommendation, and a migration risk assessment."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                aria-label="Prompt"
              />

              <div className="row-between" style={{ borderTop: "1px solid var(--border)", paddingTop: 14, flexWrap: "wrap", gap: 12 }}>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {chips.length} {chips.length === 1 ? "item" : "items"} attached · routed to {activeAgentName}
                </span>
                <button type="button" className="btn-primary" onClick={run} disabled={!prompt.trim() || loading} aria-busy={loading}>
                  {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Play size={15} aria-hidden />}
                  <span>{loading ? "Running…" : "Run"}</span>
                </button>
              </div>

              {status ? <StatusLine message={status} tone={statusTone(status, loading)} /> : null}
            </div>
          </Card>

          {result ? (
            <Card>
              <CardHead
                title="Output"
                action={
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(result);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                    >
                      <Copy size={13} aria-hidden />
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <button type="button" className="btn-ghost btn-sm">
                      <BookmarkPlus size={13} aria-hidden />
                      <span>Save to Knowledge</span>
                    </button>
                    <button type="button" className="btn-ghost btn-sm">
                      <Download size={13} aria-hidden />
                      <span>Export</span>
                    </button>
                    <button type="button" className="btn-ghost btn-sm">
                      <Share2 size={13} aria-hidden />
                      <span>Share</span>
                    </button>
                  </div>
                }
                bordered
              />
              <div className="card-pad">
                <Markdown content={result} />
              </div>
            </Card>
          ) : (
            <Card>
              <div className="empty-state">
                <Sparkles size={38} aria-hidden style={{ strokeWidth: 1.4, color: "var(--accent)", opacity: 0.8 }} />
                <h3>Nothing run yet</h3>
                <p>Describe a task above, or pick one of the suggested prompts to get started.</p>
              </div>
            </Card>
          )}
        </div>

        <aside className="rail" aria-label="Prompts and history">
          <section className="rail-section">
            <p className="section-label">Suggested prompts</p>
            {suggestedPrompts.map((p) => (
              <button
                key={p}
                type="button"
                className="card card-pad"
                style={{ textAlign: "left", fontSize: "0.85rem", lineHeight: 1.5, cursor: "pointer", padding: 14 }}
                onClick={() => setPrompt(p)}
              >
                {p}
              </button>
            ))}
          </section>

          <section className="rail-section">
            <p className="section-label">History</p>
            <Card>
              <div className="card-pad" style={{ paddingTop: 10, paddingBottom: 10 }}>
                {workspaceHistory.map((h) => (
                  <div key={h.id} className="feed-row">
                    <span className="feed-icon stat-icon blue">
                      <Clock size={13} aria-hidden />
                    </span>
                    <div className="feed-body">
                      <span style={{ fontWeight: 550 }}>{h.title}</span>
                      <p className="feed-time">{h.ago}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <p className="muted" style={{ fontSize: "0.76rem" }}>
              Demo history — persisted run history lands with the agent-runs table.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
