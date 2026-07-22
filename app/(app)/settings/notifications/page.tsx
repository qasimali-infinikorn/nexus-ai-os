import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserSettings } from "@/lib/db/queries";
import { Card, CardHead } from "@/components/workspace/ui";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/workspace/settings-content";
import { NotificationMatrix } from "./matrix";

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");

  const { notificationPrefs } = await getUserSettings(session.user.id, session.organizationId);
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...notificationPrefs };

  return (
    <Card>
      <CardHead
        title="Notifications"
        sub="Choose how you hear about each kind of event. Saved to your account."
        bordered
      />
      <div className="card-pad">
        <NotificationMatrix initial={prefs} />
      </div>
    </Card>
  );
}
