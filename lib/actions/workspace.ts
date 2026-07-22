"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  acknowledgeIncident,
  createMeeting,
  createMeetingActionItem,
  markAllNotificationsRead,
  markNotificationRead,
  resolveIncident,
  saveMeetingAgenda,
  setMeetingActionItemDone
} from "@/lib/db/workspace";

async function requireOrg() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) throw new Error("Authentication required.");
  return { userId: session.user.id, organizationId: session.organizationId };
}

export type WorkspaceFormState = { error?: string; success?: string } | undefined;

export async function markAllNotificationsReadAction(): Promise<void> {
  const { organizationId, userId } = await requireOrg();
  await markAllNotificationsRead(organizationId, userId);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const { organizationId, userId } = await requireOrg();
  await markNotificationRead({ organizationId, userId, notificationId });
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

const createMeetingSchema = z.object({
  title: z.string().trim().min(2).max(120),
  startsAt: z.string().min(1),
  location: z.string().trim().max(120).optional(),
  kind: z.string().trim().max(40).optional(),
  attendees: z.string().trim().max(500).optional()
});

export async function createMeetingAction(
  _prev: WorkspaceFormState,
  formData: FormData
): Promise<WorkspaceFormState> {
  const { organizationId } = await requireOrg();
  const parsed = createMeetingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { error: "Invalid start time." };

  const attendees = (parsed.data.attendees ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  await createMeeting({
    organizationId,
    title: parsed.data.title,
    startsAt,
    location: parsed.data.location,
    kind: parsed.data.kind || "internal",
    attendees,
    needsPrep: true
  });

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return { success: "Meeting created." };
}

export async function saveMeetingAgendaAction(
  _prev: WorkspaceFormState,
  formData: FormData
): Promise<WorkspaceFormState> {
  const { organizationId } = await requireOrg();
  const meetingId = String(formData.get("meetingId") ?? "");
  const agenda = String(formData.get("agenda") ?? "").trim();
  if (!meetingId || agenda.length < 10) return { error: "Agenda is too short." };
  if (agenda.length > 50_000) return { error: "Agenda is too long." };

  const updated = await saveMeetingAgenda({ organizationId, meetingId, agenda });
  if (!updated) return { error: "Meeting not found." };
  revalidatePath("/meetings");
  return { success: "Agenda saved." };
}

export async function addMeetingActionItemAction(
  _prev: WorkspaceFormState,
  formData: FormData
): Promise<WorkspaceFormState> {
  const { organizationId } = await requireOrg();
  const meetingId = String(formData.get("meetingId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const owner = String(formData.get("owner") ?? "—").trim() || "—";
  if (!meetingId || text.length < 2) return { error: "Action item text required." };

  await createMeetingActionItem({ organizationId, meetingId, text: text.slice(0, 500), owner: owner.slice(0, 40) });
  revalidatePath("/meetings");
  return { success: "Action item added." };
}

export async function toggleMeetingActionItemAction(formData: FormData): Promise<void> {
  const { organizationId } = await requireOrg();
  const itemId = String(formData.get("itemId") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  if (!itemId) return;
  await setMeetingActionItemDone({ organizationId, itemId, done });
  revalidatePath("/meetings");
}

export async function acknowledgeIncidentAction(formData: FormData): Promise<void> {
  const { organizationId } = await requireOrg();
  const incidentId = String(formData.get("incidentId") ?? "");
  if (!incidentId) return;
  await acknowledgeIncident(organizationId, incidentId);
  revalidatePath("/devops");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

export async function resolveIncidentAction(formData: FormData): Promise<void> {
  const { organizationId } = await requireOrg();
  const incidentId = String(formData.get("incidentId") ?? "");
  if (!incidentId) return;
  await resolveIncident(organizationId, incidentId);
  revalidatePath("/devops");
  revalidatePath("/dashboard");
}
