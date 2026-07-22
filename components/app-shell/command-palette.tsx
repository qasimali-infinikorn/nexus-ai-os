"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ALL_NAV_ITEMS } from "./nav-config";

/** Mount only while open so search state resets without effect setState. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Design default "Jump to" list: first 9 primary destinations.
      return ALL_NAV_ITEMS.slice(0, 9);
    }
    return ALL_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const goTo = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className="cmdk-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmdk" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="sr-only">
          Command palette
        </h2>
        <div className="cmdk-input-row">
          <Search size={16} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                goTo(results[active].href);
              }
            }}
            aria-autocomplete="list"
            aria-controls="cmdk-results"
            aria-activedescendant={results[active] ? `cmdk-option-${active}` : undefined}
          />
          <kbd>esc</kbd>
        </div>

        <div className="cmdk-body">
          <p className="cmdk-section-label">{query.trim() ? "Results" : "Jump to"}</p>
          {results.length === 0 ? (
            <p className="cmdk-empty">No results for “{query.trim()}”</p>
          ) : (
            <ul id="cmdk-results" role="listbox" className="cmdk-list">
              {results.map((item, index) => {
                const Icon = item.icon;
                const selected = index === active;
                return (
                  <li key={item.href} role="presentation">
                    <button
                      type="button"
                      id={`cmdk-option-${index}`}
                      role="option"
                      aria-selected={selected}
                      className={`cmdk-item${selected ? " active" : ""}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => goTo(item.href)}
                    >
                      <Icon className="cmdk-item-icon" size={15} strokeWidth={1.8} aria-hidden />
                      <span className="cmdk-item-label">Go to {item.label}</span>
                      <span className="cmdk-item-hint">Navigate</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
