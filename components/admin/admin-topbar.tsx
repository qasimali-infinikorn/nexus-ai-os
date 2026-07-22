"use client";

import { usePathname } from "next/navigation";
import { findAdminNavItem } from "./nav-config";

export function AdminTopbar() {
  const pathname = usePathname();
  const item = findAdminNavItem(pathname);
  return (
    <header className="admin-topbar">
      <div>
        <p className="admin-eyebrow">Superadmin</p>
        <h1 className="admin-page-title">{item?.label ?? "Admin"}</h1>
      </div>
      {item?.description ? <p className="dim admin-page-sub">{item.description}</p> : null}
    </header>
  );
}
