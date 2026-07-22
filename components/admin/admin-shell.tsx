"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, LogOut, Menu, Shield } from "lucide-react";
import { ADMIN_NAV } from "./nav-config";
import { logoutAction } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function AdminShell({
  userName,
  tenantCount,
  incidentCount,
  children
}: {
  userName: string;
  tenantCount?: number;
  incidentCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = ADMIN_NAV.map((item) => {
    if (item.href === "/admin/tenants" && tenantCount != null) {
      return { ...item, badge: tenantCount };
    }
    if (item.href === "/admin/status" && incidentCount != null && incidentCount > 0) {
      return { ...item, badge: incidentCount };
    }
    return item;
  });

  return (
    <div className="admin-root" data-theme="dark">
      <div className="mobile-bar">
        <button
          type="button"
          className="icon-btn"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen((o) => !o)}
        >
          <Menu size={18} aria-hidden />
        </button>
        <span className="brand text-gradient">Nexus Admin</span>
        <ThemeToggle />
      </div>

      <div
        className={`sidebar-backdrop${open ? " open" : ""}`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />

      <div className="admin-grid">
        <aside id="admin-sidebar" className={`admin-sidebar${open ? " open" : ""}`} aria-label="Admin navigation">
          <div className="sidebar-top">
            <div className="brand-row">
              <span className="brand-mark" aria-hidden>
                <Shield size={16} />
              </span>
              <div className="sidebar-brand" style={{ padding: 0 }}>
                <h2>Nexus</h2>
                <p>Platform admin</p>
              </div>
            </div>

            <nav aria-label="Admin">
              <div className="sidebar-nav-group">
                <p className="sidebar-nav-group-label">Control plane</p>
                {nav.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-link${active ? " active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      title={item.label}
                      onClick={() => setOpen(false)}
                    >
                      <Icon size={17} aria-hidden />
                      <span>{item.label}</span>
                      {item.badge != null ? (
                        <span className="nav-badge" aria-label={`${item.badge}`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>

          <div className="sidebar-footer">
            <Link href="/dashboard" className="nav-link" onClick={() => setOpen(false)}>
              <ArrowLeft size={17} aria-hidden />
              <span>Back to workspace</span>
            </Link>
            <div className="user-chip">
              <span className="user-avatar" aria-hidden>
                {initials(userName)}
              </span>
              <div className="meta">
                <p className="name">{userName}</p>
                <p className="role">Platform admin</p>
              </div>
              <form action={logoutAction}>
                <button type="submit" className="icon-btn" aria-label="Log out">
                  <LogOut size={15} aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="admin-main-col">{children}</div>
      </div>
    </div>
  );
}
