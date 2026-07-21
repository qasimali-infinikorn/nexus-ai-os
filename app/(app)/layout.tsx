import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

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

  const roleLabel = ROLE_LABELS[session.role ?? "member"] ?? "Member";

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <AppShell
        userName={session.user.name}
        roleLabel={`${roleLabel} · ${session.organizationName ?? "Workspace"}`}
        orgName={session.organizationName ?? "Workspace"}
      >
        <Topbar />
        <main id="main" className="main-content" tabIndex={-1}>
          {children}
        </main>
      </AppShell>
    </>
  );
}
