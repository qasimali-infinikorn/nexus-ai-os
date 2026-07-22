"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { findAdminNavItem } from "./nav-config";
import { AdminCommandPalette } from "./admin-command-palette";

export function AdminTopbar() {
  const pathname = usePathname();
  const item = findAdminNavItem(pathname);
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
      <header className="admin-topbar">
        <div className="admin-topbar-main">
          <div>
            <p className="admin-eyebrow">Superadmin</p>
            <h1 className="admin-page-title">{item?.label ?? "Admin"}</h1>
          </div>
          {item?.description ? <p className="dim admin-page-sub">{item.description}</p> : null}
        </div>
        <button
          type="button"
          className="admin-topbar-search"
          onClick={() => setPaletteOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={paletteOpen}
          aria-label="Search Superadmin pages"
        >
          <Search size={14} aria-hidden />
          <span>Jump to…</span>
          <kbd>⌘K</kbd>
        </button>
      </header>
      {paletteOpen ? <AdminCommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </>
  );
}
