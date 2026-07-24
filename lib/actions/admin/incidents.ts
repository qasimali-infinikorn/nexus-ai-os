"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPlatformAdmin } from "@/lib/auth/require-platform-admin";
import { writePlatformAuditEvent } from "@/lib/db/queries";
import { PLATFORM_INCIDENT_SEVERITIES } from "@/lib/db/schema";
import { createPlatformIncident, resolvePlatformIncident } from "@/lib/db/platform-incidents";

export type IncidentFormState = { error?: string; success?: string } | undefined;

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(2000).optional().or(z.literal("")),
  severity: z.enum(PLATFORM_INCIDENT_SEVERITIES)
});

export async function createPlatformIncidentAction(
  _prev: IncidentFormState,
  formData: FormData
): Promise<IncidentFormState> {
  const { user } = await assertPlatformAdmin();
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary") ?? "",
    severity: formData.get("severity")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const incident = await createPlatformIncident({
    title: parsed.data.title,
    summary: parsed.data.summary || undefined,
    severity: parsed.data.severity,
    createdByUserId: user.id
  });

  if (incident.severity === "critical") {
    const { pageCriticalIncident } = await import("@/lib/integrations/pagerduty");
    void pageCriticalIncident({
      incidentId: incident.id,
      title: incident.title,
      summary: incident.summary ?? undefined
    }).catch(() => undefined);
  }

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: "platform.incident.open",
    targetType: "platform_incident",
    targetId: incident.id,
    metadata: { title: incident.title, severity: incident.severity }
  });

  revalidatePath("/admin/status");
  revalidatePath("/admin");
  revalidatePath("/admin/audit");

  return { success: "Incident banner posted." };
}

export async function resolvePlatformIncidentAction(formData: FormData): Promise<void> {
  const { user } = await assertPlatformAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const incident = await resolvePlatformIncident({ id, resolvedByUserId: user.id });
  if (!incident) return;

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: "platform.incident.resolve",
    targetType: "platform_incident",
    targetId: incident.id,
    metadata: { title: incident.title, severity: incident.severity }
  });

  revalidatePath("/admin/status");
  revalidatePath("/admin");
  revalidatePath("/admin/audit");
}
