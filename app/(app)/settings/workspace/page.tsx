import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrganizationById, getUserSettings } from "@/lib/db/queries";
import { Card, CardHead, DemoNotice } from "@/components/workspace/ui";
import { workspaceAuditLog } from "@/lib/workspace/settings-content";
import { WorkspaceForm, AppearanceForm, DangerZone } from "./forms";

export default async function WorkspaceSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");

  const org = await getOrganizationById(session.organizationId);
  const { appearance } = await getUserSettings(session.user.id, session.organizationId);
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
        <CardHead title="Audit log" sub="Every privileged action in this workspace" bordered />
        <div className="card-pad">
          <DemoNotice>
            Sample entries. Real audit rows are already being written for key changes, invites, and task edits —
            surfacing them here is a follow-up.
          </DemoNotice>
          <div style={{ marginTop: 14 }}>
            {workspaceAuditLog.map((a) => (
              <div key={a.id} className="feed-row">
                <div className="feed-body">
                  <span className="strong">{a.actor}</span> {a.action}
                  <p className="feed-time">{a.ago}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <DangerZone canEdit={canEdit} orgName={org?.name ?? ""} />
    </div>
  );
}
