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
import { ORGANIZATION_PLAN_TIERS } from "@/lib/db/schema";

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

const stripeLinkSchema = z.object({
  organizationId: z.string().uuid(),
  stripeCustomerId: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^cus_[a-zA-Z0-9]+$/.test(v), {
      message: "Use a Stripe customer id (cus_…)."
    })
});

export async function linkTenantStripeCustomerAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { user } = await assertPlatformAdmin();
  const parsed = stripeLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const org = await getOrganizationById(parsed.data.organizationId);
  if (!org) return { error: "Organization not found." };

  const { linkOrganizationStripeIds } = await import("@/lib/db/billing");
  await linkOrganizationStripeIds({
    organizationId: org.id,
    stripeCustomerId: parsed.data.stripeCustomerId || null
  });

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: "platform.billing.link_customer",
    targetType: "organization",
    targetId: org.id,
    metadata: { stripeCustomerId: parsed.data.stripeCustomerId || null }
  });

  revalidateAdminTenantPaths(org.id);
  revalidatePath("/admin/billing");
  return {
    success: parsed.data.stripeCustomerId
      ? "Stripe customer linked."
      : "Stripe customer cleared."
  };
}
