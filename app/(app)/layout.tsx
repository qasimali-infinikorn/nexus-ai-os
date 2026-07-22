import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrganizationById } from "@/lib/db/queries";
import { getFeatureFlagsForOrg } from "@/lib/db/feature-flags";
import { AppShell } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { NexusAssistant } from "@/components/app-shell/nexus-assistant";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member"
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // proxy.ts already redirects unauthenticated requests before they reach
  // here — this is defense in depth, per the Next.js auth guide's guidance
  // that proxy/middleware is never the sole authorization check.
  if (!session?.user || !session.organizationId) {
    redirect("/login");
  }

  // The session is a JWT, so it can outlive the organization it points at
  // (org deleted, database restored from an older snapshot). Without this
  // check every org-scoped query downstream fails on a foreign key and the
  // whole app 500s; bouncing to /login lets the user sign in cleanly.
  const organization = await getOrganizationById(session.organizationId);
  if (!organization) {
    redirect("/login?stale=1");
  }

  const featureFlags = await getFeatureFlagsForOrg(session.organizationId);

  const roleLabel = ROLE_LABELS[session.role ?? "member"] ?? "Member";
  const firstName = session.user.name?.split(/\s+/)[0] || "there";

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <AppShell
        userName={session.user.name}
        roleLabel={`${roleLabel} · ${session.organizationName ?? "Workspace"}`}
        orgName={session.organizationName ?? "Workspace"}
        isPlatformAdmin={Boolean(session.user.isPlatformAdmin)}
        featureFlags={featureFlags}
      >
        <Topbar featureFlags={featureFlags} />
        <main id="main" className="main-content" tabIndex={-1}>
          {children}
        </main>
      </AppShell>

      <NexusAssistant firstName={firstName} />
    </>
  );
}
