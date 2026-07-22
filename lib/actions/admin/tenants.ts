"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  createInvitation,
  createOrganizationAsAdmin,
  getOrganizationById,
  setOrganizationStatus,
  writePlatformAuditEvent
} from "@/lib/db/queries";
import { ORGANIZATION_PLAN_TIERS, ORGANIZATION_STATUSES } from "@/lib/db/schema";

export type AdminFormState = { error?: string; success?: string; invitePath?: string } | undefined;

function revalidateAdminTenantPaths(orgId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  revalidatePath("/admin/audit");
  if (orgId) revalidatePath(`/admin/tenants/${orgId}`);
}

const suspendSchema = z.object({
  organizationId: z.string().uuid(),
  intent: z.enum(["suspend", "restore"])
});

export async function setTenantStatusAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { user } = await assertPlatformAdmin();
  const parsed = suspendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const org = await getOrganizationById(parsed.data.organizationId);
  if (!org) return { error: "Organization not found." };

  if (parsed.data.intent === "suspend") {
    if (org.status === "suspended") return { error: "Already suspended." };
    const updated = await setOrganizationStatus(org.id, "suspended");
    if (!updated) return { error: "Could not suspend organization." };

    await writePlatformAuditEvent({
      actorUserId: user.id,
      action: "platform.tenant.suspend",
      targetType: "organization",
      targetId: org.id,
      metadata: { name: org.name, previousStatus: org.status }
    });

    revalidateAdminTenantPaths(org.id);
    return { success: `Suspended ${org.name}.` };
  }

  if (org.status !== "suspended") return { error: "Organization is not suspended." };
  const restoreStatus =
    org.planTier === "trial" ? ("trial" as const) : ("active" as const);
  const updated = await setOrganizationStatus(org.id, restoreStatus);
  if (!updated) return { error: "Could not restore organization." };

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: "platform.tenant.restore",
    targetType: "organization",
    targetId: org.id,
    metadata: { name: org.name, restoredStatus: restoreStatus }
  });

  revalidateAdminTenantPaths(org.id);
  return { success: `Restored ${org.name} to ${restoreStatus}.` };
}

const createTenantSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  ownerEmail: z.string().trim().email("Enter a valid owner email."),
  planTier: z.enum(ORGANIZATION_PLAN_TIERS)
});

export async function createTenantAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { user } = await assertPlatformAdmin();
  const parsed = createTenantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const status =
    parsed.data.planTier === "trial"
      ? ("trial" as const)
      : ("active" as const);

  const organization = await createOrganizationAsAdmin({
    name: parsed.data.name,
    planTier: parsed.data.planTier,
    status
  });

  const { token } = await createInvitation({
    organizationId: organization.id,
    email: parsed.data.ownerEmail,
    role: "owner",
    invitedByUserId: user.id
  });

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: "platform.tenant.create",
    targetType: "organization",
    targetId: organization.id,
    metadata: {
      name: organization.name,
      planTier: organization.planTier,
      ownerEmail: parsed.data.ownerEmail.toLowerCase()
    }
  });

  revalidateAdminTenantPaths(organization.id);
  return {
    success: `Created ${organization.name}. Share the invite link with the owner.`,
    invitePath: `/invite/${token}`
  };
}

void ORGANIZATION_STATUSES; // keep enum import warm for future status edits
