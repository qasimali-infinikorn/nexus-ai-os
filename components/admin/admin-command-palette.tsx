"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft } from "lucide-react";
import { ADMIN_NAV, type AdminNavItem } from "./nav-config";

type PaletteItem = Pick<AdminNavItem, "href" | "label" | "icon" | "description">;

const EXTRA: PaletteItem[] = [
  {
    href: "/dashboard",
    label: "Tenant workspace",
    icon: ArrowLeft,
    description: "Leave Superadmin and return to the org app."
  }
];

export function AdminCommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const catalog = useMemo(() => [...ADMIN_NAV, ...EXTRA], []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [query, catalog]);

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
          Admin command palette
        </h2>
        <div className="cmdk-input-row">
          <Search size={16} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            placeholder="Jump to a Superadmin page…"
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
            aria-controls="admin-cmdk-results"
            aria-activedescendant={results[active] ? `admin-cmdk-option-${active}` : undefined}
          />
          <kbd>esc</kbd>
        </div>

        <div className="cmdk-body">
          <p className="cmdk-section-label">{query.trim() ? "Results" : "Control plane"}</p>
          {results.length === 0 ? (
            <p className="cmdk-empty">No results for “{query.trim()}”</p>
          ) : (
            <ul id="admin-cmdk-results" role="listbox" className="cmdk-list">
              {results.map((item, index) => {
                const Icon = item.icon;
                const selected = index === active;
                return (
                  <li key={item.href} role="presentation">
                    <button
                      type="button"
                      id={`admin-cmdk-option-${index}`}
                      role="option"
                      aria-selected={selected}
                      className={`cmdk-item${selected ? " active" : ""}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => goTo(item.href)}
                    >
                      <Icon className="cmdk-item-icon" size={15} strokeWidth={1.8} aria-hidden />
                      <span className="cmdk-item-label">{item.label}</span>
                      <span className="cmdk-item-hint">{item.href}</span>
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
