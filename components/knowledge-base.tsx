"use client";

import React, { useState, useEffect, useCallback, startTransition } from "react";
import { FolderGit, Plus, Trash2, FileText, RefreshCw } from "lucide-react";
import Markdown from "./markdown";
import { RunButton, StatusLine, OutputBlock } from "./ui";
import { streamOrchestrate, errorMessage, type AgentPanelProps } from "@/lib/orchestrate-client";

interface KnowledgeFile {
  name: string;
  sizeBytes: number;
  updatedAt: string;
}

export default function KnowledgeBase({ provider, model, keys }: AgentPanelProps) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/knowledge");
      const data = await response.json();
      if (data.success) {
        setFiles(data.files || []);
      } else {
        setError(data.error || "Failed to load files.");
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch files."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/knowledge");
        const data = await response.json();
        if (cancelled) return;
        startTransition(() => {
          if (data.success) {
            setFiles(data.files || []);
            setError("");
          } else {
            setError(data.error || "Failed to load files.");
          }
        });
      } catch (err) {
        if (cancelled) return;
        startTransition(() => {
          setError(errorMessage(err, "Failed to fetch files."));
        });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() || !newFileContent.trim()) return;
    setIsAdding(true);
    setError("");

    let cleanName = newFileName.trim();
    if (!cleanName.endsWith(".md") && !cleanName.endsWith(".txt")) {
      cleanName += ".md";
    }

    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name: cleanName, content: newFileContent })
      });

      const data = await response.json();
      if (data.success) {
        setNewFileName("");
        setNewFileContent("");
        setShowAddForm(false);
        fetchFiles();
      } else {
        setError(data.error || "Failed to save file.");
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to add file."));
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteFile = async (name: string) => {
    if (!confirm(`Delete ${name} from the knowledge base?`)) return;
    setError("");

    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", name })
      });

      const data = await response.json();
      if (data.success) {
        fetchFiles();
      } else {
        setError(data.error || "Failed to delete file.");
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to delete file."));
    }
  };

  const handleRAGSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    setSearchResult("");
    setError("");

    try {
      const contextResponse = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query: searchQuery })
      });

      const contextData = await contextResponse.json();
      if (!contextData.success) {
        throw new Error(contextData.error || "Failed to retrieve local context.");
      }

      if (!contextData.context) {
        setSearchResult(
          "No matching documents found. Add markdown files first, then ask again."
        );
        return;
      }

      await streamOrchestrate(
        {
          provider,
          model,
          prompt: `Answer the following question: "${searchQuery}"`,
          agentType: "knowledge",
          keys,
          context: contextData.context
        },
        { onResult: setSearchResult }
      );
    } catch (err) {
      console.error(err);
      setSearchResult(
        `### Search failed\n\n${errorMessage(err, "Check your configuration and try again.")}`
      );
    } finally {
      setIsSearching(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="panel kb-grid" aria-label="Knowledge base">
      <aside className="kb-files" aria-label="Indexed documents">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FolderGit size={18} aria-hidden style={{ color: "var(--accent)" }} />
            <h4 style={{ fontSize: "0.95rem" }}>Documents</h4>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="icon-btn"
              onClick={fetchFiles}
              aria-label="Refresh document list"
              title="Refresh"
            >
              <RefreshCw size={16} aria-hidden className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowAddForm((v) => !v)}
              aria-label={showAddForm ? "Close add document form" : "Add document"}
              aria-expanded={showAddForm}
              title="Add document"
              style={{
                color: showAddForm ? "var(--accent)" : undefined,
                borderColor: showAddForm ? "rgba(34,197,94,0.35)" : undefined
              }}
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" style={{ fontSize: "0.85rem", color: "var(--accent-red)" }}>
            {error}
          </p>
        ) : null}

        {showAddForm ? (
          <form
            onSubmit={handleAddFile}
            className="panel"
            style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}
          >
            <h5 style={{ fontSize: "0.85rem" }}>Add document</h5>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="kb-file-name">
                File name
              </label>
              <input
                id="kb-file-name"
                type="text"
                className="form-input"
                style={{ fontSize: "0.875rem", padding: "8px 10px" }}
                placeholder="standards.md"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="kb-file-content">
                Content
              </label>
              <textarea
                id="kb-file-content"
                className="form-input form-mono"
                style={{ fontSize: "0.8rem", padding: "8px 10px", minHeight: 100 }}
                placeholder={"# Code Standards\n\nEnsure all PRs follow SOLID principles."}
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                required
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary btn-sm" disabled={isAdding}>
                {isAdding ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="kb-file-list">
          {loading && files.length === 0 ? (
            <p className="form-hint" style={{ textAlign: "center", padding: "20px 0" }}>
              Loading documents…
            </p>
          ) : files.length === 0 ? (
            <p className="form-hint" style={{ textAlign: "center", padding: "20px 0" }}>
              No documents yet. Add markdown files to power RAG answers.
            </p>
          ) : (
            files.map((file) => (
              <div key={file.name} className="kb-file-row">
                <div className="kb-file-meta">
                  <FileText size={16} aria-hidden style={{ color: "var(--accent-sky)", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p className="name">{file.name}</p>
                    <p className="size">{formatSize(file.sizeBytes)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={`Delete ${file.name}`}
                  title={`Delete ${file.name}`}
                  onClick={() => handleDeleteFile(file.name)}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="kb-main">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <h3 style={{ fontSize: "1.05rem" }}>Ask the knowledge agent</h3>
          <span className="badge badge-sky">RAG</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="kb-query">
            Question about internal standards or design records
          </label>
          <div className="form-row">
            <input
              id="kb-query"
              type="text"
              className="form-input"
              placeholder="e.g. What are our microservice testing standards?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRAGSearch();
              }}
              disabled={isSearching}
            />
            <RunButton
              loading={isSearching}
              disabled={!searchQuery.trim()}
              onClick={handleRAGSearch}
              idleLabel="Ask"
              loadingLabel="Searching…"
            />
          </div>
        </div>

        {isSearching ? (
          <StatusLine message="Searching the index and synthesizing an answer…" tone="live" />
        ) : null}

        {searchResult ? (
          <OutputBlock>
            <Markdown content={searchResult} />
          </OutputBlock>
        ) : null}
      </div>
    </div>
  );
}
