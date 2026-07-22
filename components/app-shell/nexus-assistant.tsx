"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, X } from "lucide-react";

const SHORTCUTS = [
  { label: "Summarize today’s prod alerts", href: "/devops" },
  { label: "Draft standup notes from Sprint 24", href: "/projects" },
  { label: "What changed in PR #482?", href: "/code-review" }
] as const;

export function NexusAssistant({ firstName }: { firstName: string }) {
  const router = useRouter();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ask = (prompt?: string) => {
    const q = (prompt ?? draft).trim();
    setOpen(false);
    setDraft("");
    if (q) {
      router.push(`/ai-workspace?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/ai-workspace");
    }
  };

  return (
    <>
      {open ? (
        <div
          className="assist-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="assist-header">
            <span className="assist-mark" aria-hidden>
              <Sparkles size={12} strokeWidth={2.4} />
            </span>
            <h2 id={titleId} className="assist-title">
              Nexus Assistant
            </h2>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <X size={14} aria-hidden />
            </button>
          </div>

          <div className="assist-body">
            <div className="assist-bubble">
              Hi {firstName} — I’m watching your sprint, PRs, and prod alerts. Ask me
              anything or pick a shortcut below.
            </div>
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                type="button"
                className="assist-chip"
                onClick={() => {
                  setOpen(false);
                  router.push(s.href);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <form
            className="assist-composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="assist-input"
              placeholder="Ask Nexus…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Ask Nexus"
            />
            <button type="submit" className="assist-send" aria-label="Send">
              <Send size={14} aria-hidden />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        className={`fab${open ? " open" : ""}`}
        aria-label={open ? "Close Nexus Assistant" : "Open Nexus Assistant"}
        aria-expanded={open}
        title="Nexus Assistant"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={22} aria-hidden /> : <Sparkles size={22} aria-hidden />}
      </button>
    </>
  );
}
