import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrganizationById, getUserSettings, listOrgAuditEvents } from "@/lib/db/queries";
import { Card, CardHead } from "@/components/workspace/ui";
import { formatRelativeTime, orgAuditActionLabel } from "@/lib/workspace/admin-ui";
import { WorkspaceForm, AppearanceForm, DangerZone } from "./forms";

export default async function WorkspaceSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");

  const [org, { appearance }, auditEvents] = await Promise.all([
    getOrganizationById(session.organizationId),
    getUserSettings(session.user.id, session.organizationId),
    listOrgAuditEvents({ organizationId: session.organizationId, limit: 40 })
  ]);
  const canEdit = session.role === "owner" || session.role === "admin";

  return (
    <div className="stack-lg">
      <Card>
        <CardHead title="Workspace" sub="Organization identity. Renaming updates it everywhere." bordered />
        <div className="card-pad">
          <WorkspaceForm name={org?.name ?? ""} slug={org?.slug ?? ""} canEdit={canEdit} />
        </div>
      </Card>

      <Card>
        <CardHead title="Appearance" sub="Saved to your account, not the whole workspace." bordered />
        <div className="card-pad">
          <AppearanceForm
            reduceMotion={Boolean(appearance.reduceMotion)}
            comfortableDensity={Boolean(appearance.comfortableDensity)}
          />
        </div>
      </Card>

      <Card>
        <CardHead title="Audit log" sub="Privileged actions in this workspace" bordered />
        <div className="card-pad">
          {auditEvents.length === 0 ? (
            <p className="dim" style={{ margin: 0 }}>
              No audit events yet. Key changes, invites, renames, and task edits will show up here.
            </p>
          ) : (
            <div>
              {auditEvents.map((event) => (
                <div key={event.id} className="feed-row">
                  <div className="feed-body">
                    <span className="strong">{event.actorName ?? "Unknown"}</span>{" "}
                    {orgAuditActionLabel(
                      event.action,
                      event.metadata as Record<string, unknown> | null,
                      event.targetId
                    )}
                    <p className="feed-time">{formatRelativeTime(event.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <DangerZone canEdit={canEdit} orgName={org?.name ?? ""} />
    </div>
  );
}
