"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, PanelLeft, PanelRight } from "lucide-react";
import { findNavItem } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";
import { useShellLayout } from "./shell-layout";
import { CommandPalette } from "./command-palette";

export function Topbar() {
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const { sidebarCollapsed, contextPanelOpen, toggleSidebar, toggleContextPanel } =
    useShellLayout();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="app-topbar">
        <button
          type="button"
          className="icon-btn"
          aria-label="Toggle sidebar"
          aria-pressed={sidebarCollapsed}
          title="Toggle sidebar"
          onClick={toggleSidebar}
          style={{ flexShrink: 0 }}
        >
          <PanelLeft size={17} aria-hidden />
        </button>

        <div className="breadcrumb">
          <span>Nexus</span>
          <span aria-hidden>/</span>
          <strong>{current?.label ?? "Workspace"}</strong>
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            className="topbar-search"
            onClick={() => setPaletteOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={paletteOpen}
            aria-label="Search or jump to a page"
          >
            <Search size={14} aria-hidden />
            <span className="topbar-search-placeholder">Search or jump to…</span>
            <kbd>⌘K</kbd>
          </button>
        </div>

        <div className="topbar-actions">
          <ThemeToggle />
          <span className="icon-btn-wrap">
            <Link href="/notifications" className="icon-btn" aria-label="Notifications">
              <Bell size={17} aria-hidden />
            </Link>
            <span className="icon-btn-dot" aria-hidden />
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Context panel"
            aria-pressed={contextPanelOpen}
            title="Context panel"
            onClick={toggleContextPanel}
          >
            <PanelRight size={17} aria-hidden />
          </button>
        </div>
      </header>

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </>
  );
}
