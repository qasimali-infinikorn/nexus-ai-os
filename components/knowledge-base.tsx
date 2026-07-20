"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FolderGit, Plus, Trash2, Search, FileText, Check, Loader2, RefreshCw } from "lucide-react";
import Markdown from "./markdown";

interface KnowledgeFile {
  name: string;
  sizeBytes: number;
  updatedAt: string;
}

interface KnowledgeBaseProps {
  provider: "openai" | "anthropic" | "google";
  model: string;
  keys: { openai?: string; anthropic?: string; google?: string };
}

export default function KnowledgeBase({ provider, model, keys }: KnowledgeBaseProps) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Add file form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Fetch file list
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
    } catch (err: any) {
      setError(err.message || "Failed to fetch files.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Add a file
  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() || !newFileContent.trim()) return;
    setIsAdding(true);

    let cleanName = newFileName.trim();
    if (!cleanName.endsWith(".md") && !cleanName.endsWith(".txt")) {
      cleanName += ".md";
    }

    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          name: cleanName,
          content: newFileContent
        })
      });

      const data = await response.json();
      if (data.success) {
        setNewFileName("");
        setNewFileContent("");
        setShowAddForm(false);
        fetchFiles();
      } else {
        alert(data.error || "Failed to save file.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to add file.");
    } finally {
      setIsAdding(false);
    }
  };

  // Delete a file
  const handleDeleteFile = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          name
        })
      });

      const data = await response.json();
      if (data.success) {
        fetchFiles();
      } else {
        alert(data.error || "Failed to delete file.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete file.");
    }
  };

  // RAG Search Query via Knowledge Agent
  const handleRAGSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult("");

    try {
      // First, get relevant context from local files
      const contextResponse = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          query: searchQuery
        })
      });

      const contextData = await contextResponse.json();
      if (!contextData.success) {
        throw new Error(contextData.error || "Failed to retrieve local context.");
      }

      if (!contextData.context) {
        setSearchResult("No matching documents found in the Knowledge Base directory. Add some files first.");
        setIsSearching(false);
        return;
      }

      // Second, send query + local context to the Knowledge Agent endpoint
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          prompt: `Answer the following question: "${searchQuery}"`,
          agentType: "knowledge",
          keys,
          context: contextData.context
        })
      });

      if (!response.ok) {
        throw new Error(`Orchestration error: ${response.statusText}`);
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
              if (data.type === "agent_result" || data.type === "final_result") {
                accumulatedResult = data.content;
                setSearchResult(accumulatedResult);
              } else if (data.type === "error") {
                throw new Error(data.message);
              }
            } catch (e) {
              // Ignore partial parsing errors
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setSearchResult(`### Error searching knowledge base\n\n${err.message || "Please check your configuration and try again."}`);
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
    <div className="glass-panel" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "2px", background: "rgba(13, 17, 28, 0.4)", overflow: "hidden" }}>
      {/* Sidebar - Files List */}
      <div style={{ borderRight: "1px solid var(--border-glass)", padding: "20px", display: "flex", flexDirection: "column", gap: "15px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FolderGit size={18} style={{ color: "var(--accent-cyan)" }} />
            <h4 style={{ fontSize: "1rem" }}>Knowledge Docs</h4>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn-secondary" style={{ padding: "6px" }} onClick={fetchFiles} title="Refresh files">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button className="btn-primary" style={{ padding: "6px" }} onClick={() => setShowAddForm(!showAddForm)} title="Add doc">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {error && <p style={{ fontSize: "0.85rem", color: "var(--accent-red)" }}>{error}</p>}

        {showAddForm ? (
          <form onSubmit={handleAddFile} className="glass-panel" style={{ padding: "12px", background: "rgba(13, 17, 28, 0.9)", display: "flex", flexDirection: "column", gap: "10px" }}>
            <h5 style={{ fontSize: "0.85rem" }}>Add Document</h5>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: "0.8rem", padding: "6px 10px" }}
              placeholder="standards.md"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              required
            />
            <textarea
              className="form-input"
              style={{ fontSize: "0.8rem", padding: "6px 10px", minHeight: "100px", fontFamily: "var(--font-mono)" }}
              placeholder="# Code Standards\n\nEnsure all PRs follow SOLID principles."
              value={newFileContent}
              onChange={(e) => setNewFileContent(e.target.value)}
              required
            />
            <div style={{ display: "flex", justifySelf: "flex-end", gap: "8px" }}>
              <button type="button" className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.8rem" }} onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" style={{ padding: "4px 8px", fontSize: "0.8rem" }} disabled={isAdding}>
                {isAdding ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", maxHeight: "400px" }}>
          {files.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
              No local documents indexed. Add markdown files to train your Knowledge Agent.
            </p>
          ) : (
            files.map((file) => (
              <div key={file.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <FileText size={16} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "0.85rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#fff" }}>{file.name}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatSize(file.sizeBytes)}</p>
                  </div>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  onClick={() => handleDeleteFile(file.name)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main - RAG Query Panel */}
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "1.1rem" }}>Knowledge Agent RAG Workspace</h3>
          <span className="badge badge-cyan">Knowledge Agent</span>
        </div>

        <div className="form-group">
          <label className="form-label">Query internal standards, code conventions, or design records:</label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              className="form-input"
              style={{ flex: 1 }}
              placeholder="e.g. What are our core microservice testing standards?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSearching && searchQuery.trim()) {
                  handleRAGSearch();
                }
              }}
            />
            <button
              className="btn-primary"
              disabled={isSearching || !searchQuery.trim()}
              onClick={handleRAGSearch}
              style={{ padding: "0 24px" }}
            >
              {isSearching ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <span>Ask Agent</span>
              )}
            </button>
          </div>
        </div>

        {isSearching && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            <div className="pulse-indicator" style={{ background: "var(--accent-cyan)" }} />
            <span>Knowledge Agent searching local index and synthesizing findings...</span>
          </div>
        )}

        {searchResult && (
          <div className="glass-panel" style={{ padding: "24px", background: "#060913", border: "1px solid var(--border-glass)" }}>
            <Markdown content={searchResult} />
          </div>
        )}
      </div>
    </div>
  );
}
