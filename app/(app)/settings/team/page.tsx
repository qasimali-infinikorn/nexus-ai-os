import { auth } from "@/lib/auth";
import { listOrgMembers } from "@/lib/db/queries";
import { InviteForm } from "./invite-form";

const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" };

export default async function TeamSettingsPage() {
  const session = await auth();
  if (!session?.organizationId) return null;

  const members = await listOrgMembers(session.organizationId);
  const canInvite = session.role === "owner" || session.role === "admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {canInvite ? (
        <div className="panel">
          <div className="card-header">
            <div className="card-header-title">
              <h3>Invite a teammate</h3>
            </div>
          </div>
          <div className="card-body">
            <InviteForm />
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="card-header">
          <div className="card-header-title">
            <h3>Members</h3>
          </div>
          <span className="badge badge-sky">{members.length} total</span>
        </div>
        <div className="card-body">
          {members.map(({ user, membership }) => (
            <div className="member-row" key={membership.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600 }}>{user.name}</p>
                <p className="form-hint">{user.email}</p>
              </div>
              <span className="badge badge-sky">{ROLE_LABELS[membership.role] ?? membership.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
