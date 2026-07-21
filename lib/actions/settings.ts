"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import {
  updateUserName,
  updateUserPasswordHash,
  getUserById,
  createInvitation,
  setOrgProviderKey,
  deleteOrgProviderKey,
  writeAuditLog
} from "@/lib/db/queries";
import { ORG_KEY_PROVIDERS, MEMBERSHIP_ROLES, type MembershipRole } from "@/lib/db/schema";

export type FormState = { error?: string; success?: string } | undefined;

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    throw new Error("Authentication required.");
  }
  // Narrow organizationId from `string | null` to `string` for callers —
  // the check above already guarantees it at runtime.
  const organizationId = session.organizationId;
  return { ...session, organizationId };
}

function requireAdmin(role: string | null | undefined) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only org owners/admins can do this.");
  }
}

const profileSchema = z.object({ name: z.string().trim().min(2, "Name must be at least 2 characters.") });

export async function updateProfileAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await updateUserName(session.user.id, parsed.data.name);
  revalidatePath("/settings");
  return { success: "Profile updated." };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .regex(/[a-zA-Z]/, "New password must contain a letter.")
      .regex(/[0-9]/, "New password must contain a number.")
  });

export async function changePasswordAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const user = await getUserById(session.user.id);
  if (!user) return { error: "Account not found." };

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await updateUserPasswordHash(session.user.id, passwordHash);
  await writeAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    action: "user.password_changed"
  });

  return { success: "Password updated." };
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email address."),
  role: z.enum(MEMBERSHIP_ROLES)
});

export async function inviteTeammateAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState & { inviteUrl?: string }> {
  const session = await requireSession();
  requireAdmin(session.role);

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { token } = await createInvitation({
    organizationId: session.organizationId,
    email: parsed.data.email,
    role: parsed.data.role as MembershipRole,
    invitedByUserId: session.user.id
  });

  await writeAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    action: "invitation.created",
    targetType: "invitation",
    metadata: { email: parsed.data.email, role: parsed.data.role }
  });

  revalidatePath("/settings/team");
  return { success: "Invitation created.", inviteUrl: `/invite/${token}` };
}

const orgKeySchema = z.object({
  provider: z.enum(ORG_KEY_PROVIDERS),
  key: z.string().trim().min(10, "That doesn't look like a valid API key.")
});

export async function setOrgKeyAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  requireAdmin(session.role);

  const parsed = orgKeySchema.safeParse({ provider: formData.get("provider"), key: formData.get("key") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await setOrgProviderKey({
    organizationId: session.organizationId,
    provider: parsed.data.provider,
    plaintextKey: parsed.data.key,
    updatedByUserId: session.user.id
  });
  await writeAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    action: "org_provider_key.set",
    targetType: "org_provider_key",
    targetId: parsed.data.provider
  });

  revalidatePath("/settings/integrations");
  return { success: `${parsed.data.provider} key saved.` };
}

export async function deleteOrgKeyAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  requireAdmin(session.role);

  const parsed = z.enum(ORG_KEY_PROVIDERS).safeParse(formData.get("provider"));
  if (!parsed.success) return { error: "Invalid provider." };

  await deleteOrgProviderKey(session.organizationId, parsed.data);
  await writeAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    action: "org_provider_key.deleted",
    targetType: "org_provider_key",
    targetId: parsed.data
  });

  revalidatePath("/settings/integrations");
  return { success: `${parsed.data} key removed.` };
}
