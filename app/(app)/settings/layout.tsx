"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";

const TABS = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/workspace", label: "Workspace" }
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <PageHeader title="Settings" description="Profile, team, security, and integrations for your workspace." />
      <nav className="tabs" style={{ marginBottom: 24 }} aria-label="Settings sections">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab-link${pathname === tab.href ? " active" : ""}`}
            aria-current={pathname === tab.href ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
