"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Settings,
  Terminal,
  FileCode,
  Server,
  FileText,
  Search,
  FolderGit,
  Play,
  Key,
  Shield,
  Loader2,
  HelpCircle
} from "lucide-react";
import PRReviewer from "@/components/pr-reviewer";
import ArchitectureStudio from "@/components/architecture-studio";
import ProposalCreator from "@/components/proposal-creator";
import ResearchDigest from "@/components/research-digest";
import KnowledgeBase from "@/components/knowledge-base";
import Markdown from "@/components/markdown";

export default function Dashboard() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "pr_reviewer" | "architecture" | "proposal" | "research" | "knowledge">("dashboard");

  // API Keys (stored in local browser storage)
  const [keys, setKeys] = useState<{ openai?: string; anthropic?: string; google?: string }>({});
  const [showSettings, setShowSettings] = useState(false);

  // Key input values
  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const [anthropicKeyInput, setAnthropicKeyInput] = useState("");
  const [googleKeyInput, setGoogleKeyInput] = useState("");

  // Default LLM configuration
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("google");
  const [model, setModel] = useState("gemini-2.5-flash");

  // CEO Agent Orchestration state
  const [ceoPrompt, setCeoPrompt] = useState("");
  const [ceoLoading, setCeoLoading] = useState(false);
  const [ceoStatus, setCeoStatus] = useState("");
  const [ceoResult, setCeoResult] = useState("");
  const [activeNode, setActiveNode] = useState<"ceo_route" | "specialist" | "ceo_synthesis" | null>(null);
  const [routedAgent, setRoutedAgent] = useState<string | null>(null);

  // Load keys from localStorage on startup
  useEffect(() => {
    const savedOpenai = localStorage.getItem("nexus_key_openai") || "";
    const savedAnthropic = localStorage.getItem("nexus_key_anthropic") || "";
    const savedGoogle = localStorage.getItem("nexus_key_google") || "";

    setKeys({
      openai: savedOpenai,
      anthropic: savedAnthropic,
      google: savedGoogle
    });

    setOpenaiKeyInput(savedOpenai ? "••••••••••••••••" : "");
    setAnthropicKeyInput(savedAnthropic ? "••••••••••••••••" : "");
    setGoogleKeyInput(savedGoogle ? "••••••••••••••••" : "");

    // Load defaults if saved
    const savedProvider = localStorage.getItem("nexus_provider");
    const savedModel = localStorage.getItem("nexus_model");
    if (savedProvider) setProvider(savedProvider as any);
    if (savedModel) setModel(savedModel);
  }, []);

  // Save keys
  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedKeys = { ...keys };

    if (openaiKeyInput && openaiKeyInput !== "••••••••••••••••") {
      localStorage.setItem("nexus_key_openai", openaiKeyInput);
      updatedKeys.openai = openaiKeyInput;
    }
    if (anthropicKeyInput && anthropicKeyInput !== "••••••••••••••••") {
      localStorage.setItem("nexus_key_anthropic", anthropicKeyInput);
      updatedKeys.anthropic = anthropicKeyInput;
    }
    if (googleKeyInput && googleKeyInput !== "••••••••••••••••") {
      localStorage.setItem("nexus_key_google", googleKeyInput);
      updatedKeys.google = googleKeyInput;
    }

    setKeys(updatedKeys);
    localStorage.setItem("nexus_provider", provider);
    localStorage.setItem("nexus_model", model);
    setShowSettings(false);
    alert("Configuration successfully saved to local browser storage!");
  };

  // Clear keys
  const handleClearKeys = () => {
    if (confirm("Are you sure you want to clear all keys from local browser storage?")) {
      localStorage.removeItem("nexus_key_openai");
      localStorage.removeItem("nexus_key_anthropic");
      localStorage.removeItem("nexus_key_google");
      setKeys({});
      setOpenaiKeyInput("");
      setAnthropicKeyInput("");
      setGoogleKeyInput("");
    }
  };

  // Run Coordinator Agent (CEO Flow)
  const handleCEORun = async () => {
    if (!ceoPrompt.trim()) return;
    setCeoLoading(true);
    setCeoResult("");
    setCeoStatus("CEO initializing Nexus Operating System...");
    setActiveNode("ceo_route");
    setRoutedAgent(null);

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          prompt: ceoPrompt,
          agentType: "coordinator",
          keys
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
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
                setCeoStatus(data.message);
                // Dynamically update node graph visualization
                if (data.message.includes("routing")) {
                  setActiveNode("specialist");
                  // Try to find matching specialist name
                  const match = data.message.match(/specialist:\s*(.*?)\s*\(/);
                  if (match) setRoutedAgent(match[1]);
                } else if (data.message.includes("synthesizing") || data.message.includes("direct")) {
                  setActiveNode("ceo_synthesis");
                }
              } else if (data.type === "final_result") {
                accumulatedResult = data.content;
                setCeoResult(accumulatedResult);
              } else if (data.type === "error") {
                throw new Error(data.message);
              }
            } catch (e) {
              // Ignore line split parses
            }
          }
        }
      }
      setCeoStatus("Pipeline execution completed successfully.");
      setActiveNode(null);
    } catch (error: any) {
      console.error(error);
      setCeoResult(`### OS Execution Failed\n\n${error.message || "An unexpected error occurred. Please verify your keys and network access."}`);
      setCeoStatus("Error.");
      setActiveNode(null);
    } finally {
      setCeoLoading(false);
    }
  };

  // Helper to check if a specific key exists
  const isKeyConfigured = (prov: "openai" | "anthropic" | "google") => {
    return !!keys[prov];
  };

  return (
    <div className="dashboard-grid">
      {/* SIDEBAR NAVIGATION */}
      <aside style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border-glass)", padding: "30px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          <div>
            <h2 className="text-gradient" style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Nexus AI</h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "4px", fontWeight: 600 }}>Engineering OS</p>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
              <Terminal size={18} />
              <span>Command Center</span>
            </button>
            <button className={`nav-link ${activeTab === "pr_reviewer" ? "active" : ""}`} onClick={() => setActiveTab("pr_reviewer")}>
              <FileCode size={18} />
              <span>PR Reviewer</span>
            </button>
            <button className={`nav-link ${activeTab === "architecture" ? "active" : ""}`} onClick={() => setActiveTab("architecture")}>
              <Server size={18} />
              <span>Architecture Studio</span>
            </button>
            <button className={`nav-link ${activeTab === "proposal" ? "active" : ""}`} onClick={() => setActiveTab("proposal")}>
              <FileText size={18} />
              <span>Proposal Creator</span>
            </button>
            <button className={`nav-link ${activeTab === "research" ? "active" : ""}`} onClick={() => setActiveTab("research")}>
              <Search size={18} />
              <span>Research Digest</span>
            </button>
            <button className={`nav-link ${activeTab === "knowledge" ? "active" : ""}`} onClick={() => setActiveTab("knowledge")}>
              <FolderGit size={18} />
              <span>Knowledge Base</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
            <Activity size={14} style={{ color: isKeyConfigured(provider) ? "var(--accent-green)" : "var(--accent-red)" }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>Active Engine</p>
              <p style={{ fontSize: "0.8rem", color: "#fff", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {provider} ({model})
              </p>
            </div>
          </div>
          
          <button className="btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setShowSettings(true)}>
            <Settings size={16} />
            <span>Configure Engine</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="main-content">
        {/* HEADER BAR */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem" }}>
              {activeTab === "dashboard" && "Command Center"}
              {activeTab === "pr_reviewer" && "Pull Request Reviewer"}
              {activeTab === "architecture" && "Architecture Studio"}
              {activeTab === "proposal" && "Client Proposal Generator"}
              {activeTab === "research" && "Technology Research Digest"}
              {activeTab === "knowledge" && "Organizational Knowledge Base"}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "4px" }}>
              {activeTab === "dashboard" && "Coordinated multi-agent orchestrator for Technical Leads."}
              {activeTab === "pr_reviewer" && "Staff-level reviews, SOLID pattern checks, and technical debt estimations."}
              {activeTab === "architecture" && "Design enterprise architectures with high-level Mermaid visualizations."}
              {activeTab === "proposal" && "Generate client proposals in business language from problem specifications."}
              {activeTab === "research" && "Enterprise technology comparisons, migration guides, and developer maturity research."}
              {activeTab === "knowledge" && "Index internal standards files for RAG answers."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              <span className={`badge ${isKeyConfigured("google") ? "badge-green" : "badge-red"}`} style={{ fontSize: "0.7rem" }}>Gemini</span>
              <span className={`badge ${isKeyConfigured("anthropic") ? "badge-green" : "badge-red"}`} style={{ fontSize: "0.7rem" }}>Claude</span>
              <span className={`badge ${isKeyConfigured("openai") ? "badge-green" : "badge-red"}`} style={{ fontSize: "0.7rem" }}>OpenAI</span>
            </div>
          </div>
        </header>

        {/* SETTINGS DIALOG (OR INTERACTIVE PANEL) */}
        {showSettings && (
          <div className="glass-panel" style={{ padding: "30px", border: "1px solid rgba(0, 243, 255, 0.3)", boxShadow: "0 0 30px rgba(0, 243, 255, 0.1)", background: "rgba(13, 17, 28, 0.95)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Key style={{ color: "var(--accent-cyan)" }} />
                <h3>Engine Configuration & API Credentials</h3>
              </div>
              <button className="btn-secondary" style={{ padding: "6px 12px" }} onClick={() => setShowSettings(false)}>Close</button>
            </div>

            <form onSubmit={handleSaveKeys} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div className="form-group">
                  <label className="form-label">Active Provider:</label>
                  <select
                    className="form-select"
                    value={provider}
                    onChange={(e) => {
                      const prov = e.target.value as any;
                      setProvider(prov);
                      if (prov === "google") setModel("gemini-2.5-flash");
                      else if (prov === "anthropic") setModel("claude-3-5-sonnet-20241022");
                      else if (prov === "openai") setModel("gpt-4o");
                    }}
                  >
                    <option value="google">Google Gemini</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="openai">OpenAI GPT</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Model Name:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. gemini-2.5-flash, claude-3-5-sonnet-20241022, gpt-4o"
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--border-glass)", paddingTop: "20px" }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Google Gemini API Key:</span>
                    <span style={{ fontSize: "0.75rem", color: isKeyConfigured("google") ? "var(--accent-green)" : "var(--text-muted)" }}>
                      {isKeyConfigured("google") ? "✓ Persisted locally" : "Not set"}
                    </span>
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={googleKeyInput}
                    onChange={(e) => setGoogleKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Anthropic Claude API Key:</span>
                    <span style={{ fontSize: "0.75rem", color: isKeyConfigured("anthropic") ? "var(--accent-green)" : "var(--text-muted)" }}>
                      {isKeyConfigured("anthropic") ? "✓ Persisted locally" : "Not set"}
                    </span>
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={anthropicKeyInput}
                    onChange={(e) => setAnthropicKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>OpenAI API Key:</span>
                    <span style={{ fontSize: "0.75rem", color: isKeyConfigured("openai") ? "var(--accent-green)" : "var(--text-muted)" }}>
                      {isKeyConfigured("openai") ? "✓ Persisted locally" : "Not set"}
                    </span>
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={openaiKeyInput}
                    onChange={(e) => setOpenaiKeyInput(e.target.value)}
                    placeholder="sk-proj-..."
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                <button type="button" className="btn-secondary" style={{ color: "var(--accent-red)", borderColor: "rgba(239, 68, 68, 0.2)" }} onClick={handleClearKeys}>
                  Delete Keys from Browser
                </button>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Changes</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB WORKSPACE */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "35px" }}>
            {/* CEO Orchesration Input Card */}
            <div className="glass-panel" style={{ padding: "30px", background: "rgba(13, 17, 28, 0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <Terminal style={{ color: "var(--accent-cyan)" }} />
                <h3>Coordinated Command Console</h3>
              </div>

              <div className="form-group">
                <label className="form-label">Instruct the Nexus Chief of Staff (CEO):</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1, padding: "14px 18px", fontSize: "1.05rem" }}
                    placeholder="e.g. Conduct a full code quality audit of my shopping cart component, or write a detailed migration proposal for moving from DynamoDB to Postgres..."
                    value={ceoPrompt}
                    onChange={(e) => setCeoPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !ceoLoading && ceoPrompt.trim()) {
                        handleCEORun();
                      }
                    }}
                  />
                  <button
                    className="btn-primary"
                    disabled={ceoLoading || !ceoPrompt.trim()}
                    onClick={handleCEORun}
                    style={{ padding: "0 28px", borderRadius: "10px" }}
                  >
                    {ceoLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <Play size={16} />
                        <span>Run OS Pipeline</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {ceoStatus && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", color: "var(--text-secondary)", marginTop: "15px" }}>
                  <div className="pulse-indicator" />
                  <span>{ceoStatus}</span>
                </div>
              )}
            </div>

            {/* LIVE MULTI-AGENT EXECUTION GRAPH */}
            {ceoLoading && (
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "15px" }}>Live Agent Pipeline Execution</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", alignItems: "center", gap: "10px" }}>
                  <div className={`agent-node ${activeNode === "ceo_route" ? "active" : "completed"}`}>
                    <div style={{ padding: "8px", borderRadius: "50%", background: "rgba(0, 243, 255, 0.1)", color: "var(--accent-cyan)" }}>
                      <Terminal size={18} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "#fff" }}>CEO Router</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Classifying task</p>
                    </div>
                  </div>

                  <div style={{ width: "30px", height: "2px", background: activeNode === "ceo_route" ? "var(--border-glass)" : "var(--accent-cyan)", transition: "var(--transition-smooth)" }} />

                  <div className={`agent-node ${activeNode === "specialist" ? "active" : activeNode === "ceo_synthesis" ? "completed" : ""}`}>
                    <div style={{ padding: "8px", borderRadius: "50%", background: "rgba(189, 92, 255, 0.1)", color: "var(--accent-purple)" }}>
                      <Server size={18} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "#fff" }}>Specialist Agent</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{routedAgent || "Pending assignment"}</p>
                    </div>
                  </div>

                  <div style={{ width: "30px", height: "2px", background: activeNode === "ceo_route" || activeNode === "specialist" ? "var(--border-glass)" : "var(--accent-purple)", transition: "var(--transition-smooth)" }} />

                  <div className={`agent-node ${activeNode === "ceo_synthesis" ? "active" : ""}`}>
                    <div style={{ padding: "8px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", color: "var(--accent-green)" }}>
                      <Shield size={18} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "#fff" }}>CEO Synthesizer</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Aggregating review</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RESPONSE CONSOLE */}
            {ceoResult && (
              <div className="glass-panel" style={{ padding: "30px", background: "#060913", border: "1px solid var(--border-glass)" }}>
                <div style={{ borderBottom: "1px solid var(--border-glass)", paddingBottom: "15px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ fontSize: "1.1rem" }}>Executive Output Log</h4>
                  <span className="badge badge-cyan">Pipeline Completed</span>
                </div>
                <Markdown content={ceoResult} />
              </div>
            )}

            {/* EMPTY STATE */}
            {!ceoResult && !ceoLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                <HelpCircle size={48} style={{ strokeWidth: 1.5, marginBottom: "15px" }} />
                <h3>Waiting for Engine Instruction</h3>
                <p style={{ fontSize: "0.9rem", marginTop: "6px" }}>Use the Command Console above or select a specialized module in the sidebar to begin.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "pr_reviewer" && <PRReviewer provider={provider} model={model} keys={keys} />}
        {activeTab === "architecture" && <ArchitectureStudio provider={provider} model={model} keys={keys} />}
        {activeTab === "proposal" && <ProposalCreator provider={provider} model={model} keys={keys} />}
        {activeTab === "research" && <ResearchDigest provider={provider} model={model} keys={keys} />}
        {activeTab === "knowledge" && <KnowledgeBase provider={provider} model={model} keys={keys} />}
      </main>
    </div>
  );
}
