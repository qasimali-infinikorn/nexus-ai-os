"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPlatformAdmin } from "@/lib/auth/require-platform-admin";
import { writePlatformAuditEvent } from "@/lib/db/queries";
import { FEATURE_FLAG_AUDIENCES } from "@/lib/db/schema";
import { setFeatureFlagAudience, setFeatureFlagEnabled, getFeatureFlag, setFeatureFlagTenantOverride, clearFeatureFlagTenantOverride } from "@/lib/db/feature-flags";

export type FlagFormState = { error?: string; success?: string } | undefined;

const toggleSchema = z.object({
  key: z.string().min(1).max(80),
  enabled: z.enum(["true", "false"])
});

export async function toggleFeatureFlagAction(
  _prev: FlagFormState,
  formData: FormData
): Promise<FlagFormState> {
  const { user } = await assertPlatformAdmin();
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const enabled = parsed.data.enabled === "true";
  const flag = await setFeatureFlagEnabled({
    key: parsed.data.key,
    enabled,
    updatedByUserId: user.id
  });
  if (!flag) return { error: "Flag not found." };

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: enabled ? "platform.flag.enable" : "platform.flag.disable",
    targetType: "feature_flag",
    targetId: flag.key,
    metadata: { name: flag.name, audience: flag.audience, status: flag.status }
  });

  revalidatePath("/admin/flags");
  revalidatePath("/admin/audit");
  // Tenant nav/pages that read flags.
  revalidatePath("/proposal-studio");
  revalidatePath("/meetings");
  revalidatePath("/ai-workspace");
  revalidatePath("/dashboard");

  return { success: `${flag.name} ${enabled ? "enabled" : "disabled"}.` };
}

const audienceSchema = z.object({
  key: z.string().min(1).max(80),
  audience: z.enum(FEATURE_FLAG_AUDIENCES)
});

export async function setFeatureFlagAudienceAction(
  _prev: FlagFormState,
  formData: FormData
): Promise<FlagFormState> {
  const { user } = await assertPlatformAdmin();
  const parsed = audienceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid audience." };

  const flag = await setFeatureFlagAudience({
    key: parsed.data.key,
    audience: parsed.data.audience,
    updatedByUserId: user.id
  });
  if (!flag) return { error: "Flag not found." };

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: "platform.flag.audience",
    targetType: "feature_flag",
    targetId: flag.key,
    metadata: { name: flag.name, audience: flag.audience }
  });

  revalidatePath("/admin/flags");
  revalidatePath("/admin/audit");
  revalidatePath("/proposal-studio");
  revalidatePath("/meetings");
  revalidatePath("/ai-workspace");

  return { success: `Audience updated for ${flag.name}.` };
}

const tenantOverrideSchema = z.object({
  key: z.string().min(1).max(80),
  organizationId: z.string().uuid(),
  enabled: z.enum(["true", "false"])
});

export async function setTenantFeatureFlagOverrideAction(
  _prev: FlagFormState,
  formData: FormData
): Promise<FlagFormState> {
  const { user } = await assertPlatformAdmin();
  const parsed = tenantOverrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const enabled = parsed.data.enabled === "true";
  const flag = await getFeatureFlag(parsed.data.key);
  if (!flag) return { error: "Flag not found." };

  await setFeatureFlagTenantOverride({
    flagKey: parsed.data.key,
    organizationId: parsed.data.organizationId,
    enabled
  });

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: enabled ? "platform.flag.tenant_enable" : "platform.flag.tenant_disable",
    targetType: "feature_flag_tenant",
    targetId: `${parsed.data.key}:${parsed.data.organizationId}`,
    metadata: {
      flagKey: parsed.data.key,
      organizationId: parsed.data.organizationId,
      enabled
    }
  });

  revalidatePath(`/admin/tenants/${parsed.data.organizationId}`);
  revalidatePath("/admin/flags");
  revalidatePath("/admin/audit");
  revalidatePath("/proposal-studio");
  revalidatePath("/meetings");
  revalidatePath("/ai-workspace");
  revalidatePath("/dashboard");

  return { success: `${flag.name} override ${enabled ? "on" : "off"}.` };
}

const clearOverrideSchema = z.object({
  key: z.string().min(1).max(80),
  organizationId: z.string().uuid()
});

export async function clearTenantFeatureFlagOverrideAction(
  _prev: FlagFormState,
  formData: FormData
): Promise<FlagFormState> {
  const { user } = await assertPlatformAdmin();
  const parsed = clearOverrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const flag = await getFeatureFlag(parsed.data.key);
  if (!flag) return { error: "Flag not found." };

  await clearFeatureFlagTenantOverride({
    flagKey: parsed.data.key,
    organizationId: parsed.data.organizationId
  });

  await writePlatformAuditEvent({
    actorUserId: user.id,
    action: "platform.flag.tenant_clear",
    targetType: "feature_flag_tenant",
    targetId: `${parsed.data.key}:${parsed.data.organizationId}`,
    metadata: {
      flagKey: parsed.data.key,
      organizationId: parsed.data.organizationId
    }
  });

  revalidatePath(`/admin/tenants/${parsed.data.organizationId}`);
  revalidatePath("/admin/flags");
  revalidatePath("/admin/audit");
  revalidatePath("/proposal-studio");
  revalidatePath("/meetings");
  revalidatePath("/ai-workspace");
  revalidatePath("/dashboard");

  return { success: `${flag.name} inherits global rules again.` };
}
