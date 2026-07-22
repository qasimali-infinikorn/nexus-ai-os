import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformOverviewStats } from "@/lib/db/queries";
import { runPlatformHealthChecks } from "@/lib/platform/health";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already blocks non-admins; this re-checks the DB flag.
  const { user } = await requirePlatformAdmin();
  const [stats, health] = await Promise.all([getPlatformOverviewStats(), runPlatformHealthChecks()]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <AdminShell
        userName={user.name}
        tenantCount={stats.tenantCount}
        incidentCount={health.incidentCount}
      >
        <AdminTopbar />
        <main id="main" className="admin-content page-enter" tabIndex={-1}>
          {children}
        </main>
      </AdminShell>
    </>
  );
}
