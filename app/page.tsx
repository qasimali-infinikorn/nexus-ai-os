"use client";

import React, { useState, useEffect, useCallback, startTransition } from "react";
import {
  Settings,
  Terminal,
  FileCode,
  Server,
  FileText,
  Search,
  FolderGit,
  Check,
  X,
  Menu
} from "lucide-react";
import PRReviewer from "@/components/pr-reviewer";
import ArchitectureStudio from "@/components/architecture-studio";
import ProposalCreator from "@/components/proposal-creator";
import ResearchDigest from "@/components/research-digest";
import KnowledgeBase from "@/components/knowledge-base";
import CommandCenter from "@/components/command-center";
import SettingsDialog from "@/components/settings-dialog";
import {
  streamOrchestrate,
  errorMessage,
  isProvider,
  type Provider,
  type ApiKeys,
  type AgentPanelProps
} from "@/lib/orchestrate-client";

const TABS = [
  {
    id: "dashboard",
    label: "Command Center",
    icon: Terminal,
    title: "Command Center",
    description: "Route a task to the right specialist and get an executive synthesis."
  },
  {
    id: "pr_reviewer",
    label: "PR Reviewer",
    icon: FileCode,
    title: "Pull Request Reviewer",
    description: "Staff-level reviews, SOLID checks, and technical debt estimates."
  },
  {
    id: "architecture",
    label: "Architecture Studio",
    icon: Server,
    title: "Architecture Studio",
    description: "Design system architectures with Mermaid diagrams you can export."
  },
  {
    id: "proposal",
    label: "Proposal Creator",
    icon: FileText,
    title: "Client Proposal Generator",
    description: "Turn problem specs into client-ready proposals in business language."
  },
  {
    id: "research",
    label: "Research Digest",
    icon: Search,
    title: "Technology Research Digest",
    description: "Compare stacks, plan migrations, and gauge enterprise readiness."
  },
  {
    id: "knowledge",
    label: "Knowledge Base",
    icon: FolderGit,
    title: "Organizational Knowledge Base",
    description: "Index internal standards and ask RAG questions against them."
  }
] as const;

type TabId = (typeof TABS)[number]["id"];

const FEATURE_PANELS: { id: TabId; Panel: React.ComponentType<AgentPanelProps> }[] = [
  { id: "pr_reviewer", Panel: PRReviewer },
  { id: "architecture", Panel: ArchitectureStudio },
  { id: "proposal", Panel: ProposalCreator },
  { id: "research", Panel: ResearchDigest },
  { id: "knowledge", Panel: KnowledgeBase }
];

const PROVIDER_BADGES: { provider: Provider; label: string }[] = [
  { provider: "google", label: "Gemini" },
  { provider: "anthropic", label: "Claude" },
  { provider: "openai", label: "OpenAI" }
];

const DEFAULT_MODELS: Record<Provider, string> = {
  google: "gemini-2.5-flash",
  anthropic: "claude-3-5-sonnet-20241022",
  openai: "gpt-4o"
};

const KEY_MASK = "••••••••••••••••";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set(["dashboard"]));
  const [navOpen, setNavOpen] = useState(false);

  const [keys, setKeys] = useState<ApiKeys>({});
  const [showSettings, setShowSettings] = useState(false);
  const [keyInputs, setKeyInputs] = useState<Record<Provider, string>>({
    openai: "",
    anthropic: "",
    google: ""
  });
  const [saveNotice, setSaveNotice] = useState("");

  const [provider, setProvider] = useState<Provider>("google");
  const [model, setModel] = useState(DEFAULT_MODELS.google);

  const [ceoPrompt, setCeoPrompt] = useState("");
  const [ceoLoading, setCeoLoading] = useState(false);
  const [ceoStatus, setCeoStatus] = useState("");
  const [ceoResult, setCeoResult] = useState("");
  const [activeNode, setActiveNode] = useState<"ceo_route" | "specialist" | "ceo_synthesis" | null>(null);
  const [routedAgent, setRoutedAgent] = useState<string | null>(null);

  useEffect(() => {
    const saved: ApiKeys = {
      openai: localStorage.getItem("nexus_key_openai") || "",
      anthropic: localStorage.getItem("nexus_key_anthropic") || "",
      google: localStorage.getItem("nexus_key_google") || ""
    };

    // Hydrate from localStorage after mount (client-only).
    startTransition(() => {
      setKeys(saved);
      setKeyInputs({
        openai: saved.openai ? KEY_MASK : "",
        anthropic: saved.anthropic ? KEY_MASK : "",
        google: saved.google ? KEY_MASK : ""
      });

      const savedProvider = localStorage.getItem("nexus_provider");
      const savedModel = localStorage.getItem("nexus_model");
      if (isProvider(savedProvider)) setProvider(savedProvider);
      if (savedModel) setModel(savedModel);
    });
  }, []);

  useEffect(() => {
    if (!saveNotice) return;
    const timer = setTimeout(() => setSaveNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [saveNotice]);

  const closeSettings = useCallback(() => setShowSettings(false), []);

  const openTab = (tab: TabId) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
    setNavOpen(false);
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedKeys = { ...keys };

    for (const { provider: prov } of PROVIDER_BADGES) {
      const input = keyInputs[prov].trim();
      if (input && input !== KEY_MASK) {
        localStorage.setItem(`nexus_key_${prov}`, input);
        updatedKeys[prov] = input;
      }
    }

    setKeys(updatedKeys);
    setKeyInputs({
      openai: updatedKeys.openai ? KEY_MASK : "",
      anthropic: updatedKeys.anthropic ? KEY_MASK : "",
      google: updatedKeys.google ? KEY_MASK : ""
    });
    localStorage.setItem("nexus_provider", provider);
    localStorage.setItem("nexus_model", model);
    setSaveNotice("Configuration saved to this browser.");
  };

  const handleClearKeys = () => {
    if (!confirm("Delete all API keys from this browser's storage?")) return;
    for (const { provider: prov } of PROVIDER_BADGES) {
      localStorage.removeItem(`nexus_key_${prov}`);
    }
    setKeys({});
    setKeyInputs({ openai: "", anthropic: "", google: "" });
    setSaveNotice("All keys deleted from this browser.");
  };

  const handleProviderChange = (next: Provider) => {
    setProvider(next);
    setModel(DEFAULT_MODELS[next]);
  };

  const handleCEORun = async () => {
    if (!ceoPrompt.trim() || ceoLoading) return;
    setCeoLoading(true);
    setCeoResult("");
    setCeoStatus("Initializing pipeline…");
    setActiveNode("ceo_route");
    setRoutedAgent(null);

    try {
      await streamOrchestrate(
        { provider, model, prompt: ceoPrompt, agentType: "coordinator", keys },
        {
          onStatus: (message) => {
            setCeoStatus(message);
            if (message.includes("routing")) {
              setActiveNode("specialist");
              const match = message.match(/specialist:\s*(.*?)\s*\(/);
              if (match) setRoutedAgent(match[1]);
            } else if (message.includes("synthesizing") || message.includes("direct")) {
              setActiveNode("ceo_synthesis");
            }
          },
          onResult: setCeoResult
        }
      );
      setCeoStatus("Pipeline completed.");
    } catch (error) {
      console.error(error);
      setCeoResult(
        `### Pipeline failed\n\n${errorMessage(error, "Something went wrong. Check your API keys and network, then try again.")}`
      );
      setCeoStatus("Error.");
    } finally {
      setCeoLoading(false);
      setActiveNode(null);
    }
  };

  const isKeyConfigured = (prov: Provider) => Boolean(keys[prov]);
  const currentTab = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <div className="mobile-bar">
        <button
          type="button"
          className="icon-btn"
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
          onClick={() => setNavOpen((o) => !o)}
        >
          <Menu size={20} aria-hidden />
        </button>
        <span className="brand text-gradient">Nexus AI</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Configure engine"
          onClick={() => setShowSettings(true)}
        >
          <Settings size={18} aria-hidden />
        </button>
      </div>

      <div
        className={`sidebar-backdrop${navOpen ? " open" : ""}`}
        aria-hidden={!navOpen}
        onClick={() => setNavOpen(false)}
      />

      <div className="dashboard-grid">
        <aside
          id="app-sidebar"
          className={`sidebar${navOpen ? " open" : ""}`}
          aria-label="App navigation"
        >
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <h2 className="text-gradient">Nexus AI</h2>
              <p>Engineering OS</p>
            </div>

            <nav className="sidebar-nav" aria-label="Primary">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`nav-link${activeTab === id ? " active" : ""}`}
                  aria-current={activeTab === id ? "page" : undefined}
                  onClick={() => openTab(id)}
                >
                  <Icon size={18} aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="sidebar-footer">
            <div className="engine-chip">
              <span
                className={`dot ${isKeyConfigured(provider) ? "ok" : "missing"}`}
                aria-hidden
              />
              <div className="meta">
                <p className="label">Active engine</p>
                <p className="value">
                  {provider} · {model}
                  <span className="sr-only">
                    {isKeyConfigured(provider) ? ", key configured" : ", key missing"}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary"
              style={{ width: "100%" }}
              onClick={() => {
                setShowSettings(true);
                setNavOpen(false);
              }}
            >
              <Settings size={16} aria-hidden />
              <span>Configure engine</span>
            </button>
          </div>
        </aside>

        <main id="main" className="main-content" tabIndex={-1}>
          <header className="page-header">
            <div>
              <h1>{currentTab.title}</h1>
              <p className="lede">{currentTab.description}</p>
            </div>

            <div className="provider-badges" aria-label="Provider key status">
              {PROVIDER_BADGES.map(({ provider: prov, label }) => (
                <span
                  key={prov}
                  className={`badge ${isKeyConfigured(prov) ? "badge-green" : "badge-red"}`}
                  title={`${label} API key ${isKeyConfigured(prov) ? "configured" : "not configured"}`}
                >
                  {isKeyConfigured(prov) ? (
                    <Check size={12} aria-hidden />
                  ) : (
                    <X size={12} aria-hidden />
                  )}
                  {label}
                  <span className="sr-only">
                    {isKeyConfigured(prov) ? "key configured" : "key not configured"}
                  </span>
                </span>
              ))}
            </div>
          </header>

          <div hidden={activeTab !== "dashboard"}>
            <CommandCenter
              prompt={ceoPrompt}
              onPromptChange={setCeoPrompt}
              loading={ceoLoading}
              status={ceoStatus}
              result={ceoResult}
              activeNode={activeNode}
              routedAgent={routedAgent}
              onRun={handleCEORun}
            />
          </div>

          {FEATURE_PANELS.map(({ id, Panel }) =>
            visitedTabs.has(id) ? (
              <div key={id} hidden={activeTab !== id}>
                <Panel provider={provider} model={model} keys={keys} />
              </div>
            ) : null
          )}
        </main>
      </div>

      <SettingsDialog
        open={showSettings}
        onClose={closeSettings}
        provider={provider}
        model={model}
        keys={keys}
        keyInputs={keyInputs}
        saveNotice={saveNotice}
        onProviderChange={handleProviderChange}
        onModelChange={setModel}
        onKeyInputChange={(prov, value) =>
          setKeyInputs((prev) => ({ ...prev, [prov]: value }))
        }
        onSave={handleSaveKeys}
        onClearKeys={handleClearKeys}
        isKeyConfigured={isKeyConfigured}
      />
    </>
  );
}
