"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  deleteGoogleCalendarConnection,
  syncGoogleCalendarMeetings
} from "@/lib/integrations/google-calendar";
import { writeAuditLog } from "@/lib/db/queries";

export async function disconnectGoogleCalendarAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) throw new Error("Authentication required.");
  await deleteGoogleCalendarConnection(session.user.id, session.organizationId);
  await writeAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    action: "integration.google_calendar.disconnect",
    targetType: "oauth_connection",
    targetId: "google_calendar"
  });
  revalidatePath("/settings/integrations");
  revalidatePath("/meetings");
}

export async function syncGoogleCalendarAction(): Promise<{ error?: string; success?: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) return { error: "Authentication required." };
  try {
    const { upserted } = await syncGoogleCalendarMeetings({
      userId: session.user.id,
      organizationId: session.organizationId
    });
    revalidatePath("/meetings");
    revalidatePath("/dashboard");
    return { success: `Synced ${upserted} event${upserted === 1 ? "" : "s"}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sync failed." };
  }
}
