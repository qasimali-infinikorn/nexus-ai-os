"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { NAV_GROUPS } from "./nav-config";
import { logoutAction } from "@/lib/actions/auth";
import { ThemeToggle } from "./theme-toggle";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Renders the mobile top bar, the collapsible backdrop, the sidebar `<aside>`,
 * AND wraps `children` (the Topbar + main content) inside `.dashboard-grid`.
 *
 * This all lives in one component — not split across siblings placed
 * separately in app/(app)/layout.tsx — because `.dashboard-grid` is a CSS
 * Grid with `grid-template-columns: var(--sidebar-width) 1fr` that expects
 * EXACTLY two direct children (the sidebar column, the content column).
 * `.mobile-bar` and `.sidebar-backdrop` must be siblings of `.dashboard-grid`,
 * not children of it — putting them inside (e.g. via a Fragment as the
 * grid's first child) adds extra grid items and wraps the layout into two
 * rows instead of two columns.
 */
export function AppShell({
  userName,
  roleLabel,
  orgName,
  children
}: {
  userName: string;
  roleLabel: string;
  orgName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mobile-bar">
        <button
          type="button"
          className="icon-btn"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen((o) => !o)}
        >
          <Menu size={18} aria-hidden />
        </button>
        <span className="brand text-gradient">Nexus AI</span>
        <ThemeToggle />
      </div>

      <div
        className={`sidebar-backdrop${open ? " open" : ""}`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />

      <div className="dashboard-grid">
        <aside id="app-sidebar" className={`sidebar${open ? " open" : ""}`} aria-label="App navigation">
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <h2 className="text-gradient">Nexus</h2>
              <p>{orgName}</p>
            </div>

            <nav aria-label="Primary">
              {NAV_GROUPS.map((group) => (
                <div className="sidebar-nav-group" key={group.label}>
                  <p className="sidebar-nav-group-label">{group.label}</p>
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-link${active ? " active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                      >
                        <Icon size={17} aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>

          <div className="sidebar-footer">
            <div className="user-chip">
              <span className="user-avatar" aria-hidden>
                {initials(userName)}
              </span>
              <div className="meta">
                <p className="name">{userName}</p>
                <p className="role">{roleLabel}</p>
              </div>
              <form action={logoutAction}>
                <button type="submit" className="icon-btn" aria-label="Log out">
                  <LogOut size={15} aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>{children}</div>
      </div>
    </>
  );
}
