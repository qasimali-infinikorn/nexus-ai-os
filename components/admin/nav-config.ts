import {
  LayoutDashboard,
  Building2,
  Flag,
  CreditCard,
  Activity,
  ScrollText,
  type LucideIcon
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Optional count / incident badge (wired in later phases). */
  badge?: number | string;
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Platform health and tenant mix."
  },
  {
    href: "/admin/tenants",
    label: "Tenants",
    icon: Building2,
    description: "Search, filter, and manage organizations."
  },
  {
    href: "/admin/flags",
    label: "Feature Flags",
    icon: Flag,
    description: "Toggle capabilities by audience."
  },
  {
    href: "/admin/billing",
    label: "Billing",
    icon: CreditCard,
    description: "MRR, invoices, and failed payments."
  },
  {
    href: "/admin/status",
    label: "System Status",
    icon: Activity,
    description: "Service health and incidents."
  },
  {
    href: "/admin/audit",
    label: "Audit Log",
    icon: ScrollText,
    description: "Privileged-action trail."
  }
];

export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
  if (pathname === "/admin") return ADMIN_NAV[0];
  return ADMIN_NAV.find((item) => item.href !== "/admin" && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
}
