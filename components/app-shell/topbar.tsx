"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { ALL_NAV_ITEMS, findNavItem } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const current = findNavItem(pathname);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return ALL_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(lower)).slice(0, 6);
  }, [query]);

  const goTo = (href: string) => {
    setQuery("");
    setFocused(false);
    router.push(href);
  };

  return (
    <header className="app-topbar">
      <div className="breadcrumb">
        <span>Nexus</span>
        <span aria-hidden>/</span>
        <strong>{current?.label ?? "Workspace"}</strong>
      </div>

      <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center" }}>
        <label className="topbar-search" htmlFor="app-quick-jump">
          <Search size={14} aria-hidden />
          <input
            id="app-quick-jump"
            ref={inputRef}
            type="text"
            placeholder="Search or jump to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) goTo(matches[0].href);
              if (e.key === "Escape") inputRef.current?.blur();
            }}
            style={{
              background: "none",
              border: "none",
              outline: "none",
              color: "inherit",
              font: "inherit",
              width: "100%"
            }}
            aria-label="Search or jump to a page"
            aria-expanded={focused && matches.length > 0}
            aria-controls="quick-jump-results"
            role="combobox"
            aria-autocomplete="list"
          />
          <kbd>⌘K</kbd>
        </label>

        {focused && matches.length > 0 ? (
          <ul
            id="quick-jump-results"
            role="listbox"
            className="panel"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              width: "min(360px, 100%)",
              zIndex: 30,
              listStyle: "none",
              overflow: "hidden"
            }}
          >
            {matches.map((item) => (
              <li key={item.href} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="nav-link"
                  style={{ borderRadius: 0 }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goTo(item.href)}
                >
                  <item.icon size={17} aria-hidden />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="topbar-actions">
        <ThemeToggle />
        <span className="icon-btn-wrap">
          <a href="/notifications" className="icon-btn" aria-label="Notifications">
            <Bell size={17} aria-hidden />
          </a>
        </span>
      </div>
    </header>
  );
}
