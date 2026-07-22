import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInvitationByToken, acceptInvitation, getOrganizationById } from "@/lib/db/queries";
import { AuthShell } from "@/components/auth/auth-shell";
import { Sparkles } from "lucide-react";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return (
      <AuthShell>
        <div className="auth-card">
          <div className="auth-card-brand">
            <span className="auth-card-mark">
              <Sparkles size={16} strokeWidth={2.4} aria-hidden />
            </span>
            <span>Nexus</span>
          </div>
          <h1 className="auth-title">Invite not valid</h1>
          <p className="auth-subtitle">
            This invitation link has expired, was already used, or doesn&rsquo;t exist.
          </p>
          <Link href="/login" className="btn-primary auth-submit">
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const session = await auth();
  if (session?.user?.id) {
    await acceptInvitation(token, session.user.id);
    redirect("/dashboard");
  }

  const organization = await getOrganizationById(invitation.organizationId);

  return (
    <AuthShell>
      <div className="auth-card">
        <div className="auth-card-brand">
          <span className="auth-card-mark">
            <Sparkles size={16} strokeWidth={2.4} aria-hidden />
          </span>
          <span>Nexus</span>
        </div>
        <h1 className="auth-title">Join {organization?.name ?? "a workspace"}</h1>
        <p className="auth-subtitle">
          You&rsquo;ve been invited as <strong>{invitation.role}</strong>. Sign in or create an account
          with <strong>{invitation.email}</strong> to accept.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href={`/login?from=/invite/${token}`} className="btn-primary auth-submit">
            Sign in
          </Link>
          <Link href={`/signup?from=/invite/${token}`} className="btn-secondary" style={{ width: "100%" }}>
            Create account
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
