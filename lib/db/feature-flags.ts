import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./client";
import {
  featureFlags,
  featureFlagTenants,
  organizations,
  type FeatureFlag,
  type FeatureFlagAudience,
  type FeatureFlagStatus,
  type OrganizationPlanTier
} from "./schema";

/** Mockup-parity defaults. Inserted once via `ensureFeatureFlagsSeeded`. */
export const DEFAULT_FEATURE_FLAGS: {
  key: string;
  name: string;
  description: string;
  status: FeatureFlagStatus;
  audience: FeatureFlagAudience;
  enabled: boolean;
}[] = [
  {
    key: "ai-workspace",
    name: "AI Workspace",
    description: "Route tasks to specialist agents from the workspace.",
    status: "ga",
    audience: "all",
    enabled: true
  },
  {
    key: "live-meetings",
    name: "Live Meetings",
    description: "Meeting prep and calendar-linked agendas.",
    status: "beta",
    audience: "all",
    enabled: true
  },
  {
    key: "proposal-studio",
    name: "Proposal Studio",
    description: "Client-ready proposals from problem specs.",
    status: "ga",
    audience: "all",
    enabled: true
  },
  {
    key: "byo-model",
    name: "Bring your own model",
    description: "Org-level provider keys for OpenAI, Anthropic, and Google.",
    status: "beta",
    audience: "business_plus",
    enabled: true
  },
  {
    key: "sso-scim",
    name: "SSO / SCIM",
    description: "Enterprise identity federation and directory sync.",
    status: "alpha",
    audience: "enterprise",
    enabled: false
  },
  {
    key: "usage-billing",
    name: "Usage billing",
    description: "Metered agent-run billing for opted-in tenants.",
    status: "alpha",
    audience: "opt_in",
    enabled: false
  }
];

export async function ensureFeatureFlagsSeeded(): Promise<void> {
  const db = getDb();
  for (const flag of DEFAULT_FEATURE_FLAGS) {
    await db
      .insert(featureFlags)
      .values(flag)
      .onConflictDoNothing({ target: featureFlags.key });
  }
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  await ensureFeatureFlagsSeeded();
  const db = getDb();
  return db.select().from(featureFlags).orderBy(asc(featureFlags.name));
}

export async function getFeatureFlag(key: string): Promise<FeatureFlag | undefined> {
  await ensureFeatureFlagsSeeded();
  const db = getDb();
  const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
  return flag;
}

export async function setFeatureFlagEnabled(params: {
  key: string;
  enabled: boolean;
  updatedByUserId: string;
}): Promise<FeatureFlag | undefined> {
  await ensureFeatureFlagsSeeded();
  const db = getDb();
  const [flag] = await db
    .update(featureFlags)
    .set({
      enabled: params.enabled,
      updatedAt: new Date(),
      updatedByUserId: params.updatedByUserId
    })
    .where(eq(featureFlags.key, params.key))
    .returning();
  return flag;
}

export async function setFeatureFlagAudience(params: {
  key: string;
  audience: FeatureFlagAudience;
  updatedByUserId: string;
}): Promise<FeatureFlag | undefined> {
  await ensureFeatureFlagsSeeded();
  const db = getDb();
  const [flag] = await db
    .update(featureFlags)
    .set({
      audience: params.audience,
      updatedAt: new Date(),
      updatedByUserId: params.updatedByUserId
    })
    .where(eq(featureFlags.key, params.key))
    .returning();
  return flag;
}

function audienceAllowsPlan(audience: FeatureFlagAudience, planTier: OrganizationPlanTier): boolean {
  switch (audience) {
    case "all":
      return true;
    case "business_plus":
      return planTier === "business" || planTier === "enterprise";
    case "enterprise":
      return planTier === "enterprise";
    case "opt_in":
    case "tenant_list":
      // Requires an explicit per-tenant override row.
      return false;
  }
}

/**
 * Resolve whether a flag is on for an organization.
 * Tenant override wins; otherwise global enabled + audience vs plan tier.
 */
export async function isFeatureEnabledForOrg(organizationId: string, key: string): Promise<boolean> {
  const flag = await getFeatureFlag(key);
  if (!flag) return false;

  const db = getDb();
  const [override] = await db
    .select()
    .from(featureFlagTenants)
    .where(
      and(eq(featureFlagTenants.flagKey, key), eq(featureFlagTenants.organizationId, organizationId))
    )
    .limit(1);
  if (override) return override.enabled;

  if (!flag.enabled) return false;

  const [org] = await db
    .select({ planTier: organizations.planTier })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return false;

  return audienceAllowsPlan(flag.audience, org.planTier);
}

/** Map of flag key → enabled for this org (after audience + overrides). */
export async function getFeatureFlagsForOrg(organizationId: string): Promise<Record<string, boolean>> {
  const flags = await listFeatureFlags();
  const result: Record<string, boolean> = {};
  for (const flag of flags) {
    result[flag.key] = await isFeatureEnabledForOrg(organizationId, flag.key);
  }
  return result;
}

export async function setFeatureFlagTenantOverride(params: {
  flagKey: string;
  organizationId: string;
  enabled: boolean;
}): Promise<void> {
  await ensureFeatureFlagsSeeded();
  const db = getDb();
  await db
    .insert(featureFlagTenants)
    .values({
      flagKey: params.flagKey,
      organizationId: params.organizationId,
      enabled: params.enabled
    })
    .onConflictDoUpdate({
      target: [featureFlagTenants.flagKey, featureFlagTenants.organizationId],
      set: { enabled: params.enabled, updatedAt: new Date() }
    });
}

export async function clearFeatureFlagTenantOverride(params: {
  flagKey: string;
  organizationId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .delete(featureFlagTenants)
    .where(
      and(
        eq(featureFlagTenants.flagKey, params.flagKey),
        eq(featureFlagTenants.organizationId, params.organizationId)
      )
    );
}

/** Effective + override state for the admin tenant detail matrix. */
export async function listTenantFeatureFlagStates(organizationId: string): Promise<
  {
    flag: FeatureFlag;
    effective: boolean;
    override: boolean | null;
    inherited: boolean;
  }[]
> {
  const flags = await listFeatureFlags();
  const db = getDb();
  const [org] = await db
    .select({ planTier: organizations.planTier })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return [];

  const overrides = await db
    .select()
    .from(featureFlagTenants)
    .where(eq(featureFlagTenants.organizationId, organizationId));
  const byKey = new Map(overrides.map((o) => [o.flagKey, o.enabled]));

  return flags.map((flag) => {
    const override = byKey.has(flag.key) ? Boolean(byKey.get(flag.key)) : null;
    const inherited = flag.enabled && audienceAllowsPlan(flag.audience, org.planTier);
    const effective = override !== null ? override : inherited;
    return { flag, effective, override, inherited };
  });
}
