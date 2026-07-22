import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserSettings } from "@/lib/db/queries";
import { emailConfigured } from "@/lib/notifications/deliver";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/workspace/settings-content";
import { NotificationMatrix } from "./matrix";
import { SlackWebhookForm } from "./slack-webhook-form";

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");

  const { notificationPrefs, delivery } = await getUserSettings(session.user.id, session.organizationId);
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...notificationPrefs };
  const emailReady = emailConfigured();

  return (
    <div className="stack-lg">
      <Card>
        <CardHead
          title="Notifications"
          sub="Choose how you hear about each kind of event. Saved to your account."
          bordered
        />
        <div className="card-pad stack-md">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Pill tone={emailReady ? "green" : "slate"}>
              Email {emailReady ? "ready (Resend)" : "needs RESEND_API_KEY + EMAIL_FROM"}
            </Pill>
            <Pill tone={delivery.slackWebhookUrl ? "green" : "slate"}>
              Slack {delivery.slackWebhookUrl ? "webhook saved" : "webhook not set"}
            </Pill>
          </div>
          <NotificationMatrix initial={prefs} />
        </div>
      </Card>

      <Card>
        <CardHead title="Slack delivery" sub="Personal incoming webhook for events with Slack enabled." bordered />
        <div className="card-pad">
          <SlackWebhookForm initialUrl={delivery.slackWebhookUrl} />
        </div>
      </Card>
    </div>
  );
}
