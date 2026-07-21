import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getInvitationByToken, acceptInvitation, getOrganizationById } from "@/lib/db/queries";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1 className="auth-title">Invite not valid</h1>
          <p className="auth-subtitle">This invitation link has expired, was already used, or doesn&rsquo;t exist.</p>
          <Link href="/login" className="btn-primary">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const session = await auth();
  if (session?.user?.id) {
    await acceptInvitation(token, session.user.id);
    redirect("/dashboard");
  }

  const organization = await getOrganizationById(invitation.organizationId);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">Join {organization?.name ?? "a workspace"}</h1>
        <p className="auth-subtitle">
          You&rsquo;ve been invited as <strong>{invitation.role}</strong>. Log in or create an account with{" "}
          <strong>{invitation.email}</strong> to accept.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={`/login?from=/invite/${token}`} className="btn-primary">
            Log in
          </Link>
          <Link href={`/signup?from=/invite/${token}`} className="btn-secondary">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
