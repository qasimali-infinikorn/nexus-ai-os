import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { createUserAndOrg } from "@/lib/db/queries";
import {
  ensureFeatureFlagsSeeded,
  getFeatureFlagsForOrg,
  isFeatureEnabledForOrg,
  listFeatureFlags,
  listTenantFeatureFlagStates,
  setFeatureFlagEnabled,
  setFeatureFlagTenantOverride,
  clearFeatureFlagTenantOverride
} from "@/lib/db/feature-flags";
import { featureFlagTenants, featureFlags, organizations, users, memberships, invitations, auditLog } from "@/lib/db/schema";
import { createTestDb } from "../helpers/testDb";
import { eq } from "drizzle-orm";

let testDb: Database;

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-only-encryption-key-do-not-use-in-prod";
  testDb = await createTestDb();
});

beforeEach(async () => {
  __setDbForTests(testDb);
  await testDb.delete(featureFlagTenants);
  await testDb.delete(featureFlags);
  await testDb.delete(auditLog);
  await testDb.delete(invitations);
  await testDb.delete(memberships);
  await testDb.delete(users);
  await testDb.delete(organizations);
});

describe("feature flags", () => {
  it("seeds default flags once", async () => {
    await ensureFeatureFlagsSeeded();
    const first = await listFeatureFlags();
    expect(first.length).toBeGreaterThanOrEqual(6);
    expect(first.some((f) => f.key === "proposal-studio")).toBe(true);

    await ensureFeatureFlagsSeeded();
    const second = await listFeatureFlags();
    expect(second).toHaveLength(first.length);
  });

  it("respects global enabled and audience for an org", async () => {
    const { organization } = await createUserAndOrg({
      email: "trial@example.com",
      name: "Trial",
      passwordHash: "h",
      organizationName: "Trial Co"
    });

    await ensureFeatureFlagsSeeded();
    expect(await isFeatureEnabledForOrg(organization.id, "proposal-studio")).toBe(true);

    await setFeatureFlagEnabled({
      key: "proposal-studio",
      enabled: false,
      updatedByUserId: (await createUserAndOrg({
        email: "ops2@example.com",
        name: "Ops",
        passwordHash: "h",
        organizationName: "Ops 2"
      })).user.id
    });
    expect(await isFeatureEnabledForOrg(organization.id, "proposal-studio")).toBe(false);
  });

  it("gates business_plus audience by plan tier", async () => {
    const trial = await createUserAndOrg({
      email: "t@example.com",
      name: "T",
      passwordHash: "h",
      organizationName: "Trial Org"
    });
    const biz = await createUserAndOrg({
      email: "b@example.com",
      name: "B",
      passwordHash: "h",
      organizationName: "Biz Org"
    });
    await testDb
      .update(organizations)
      .set({ planTier: "business", status: "active" })
      .where(eq(organizations.id, biz.organization.id));

    await ensureFeatureFlagsSeeded();
    expect(await isFeatureEnabledForOrg(trial.organization.id, "byo-model")).toBe(false);
    expect(await isFeatureEnabledForOrg(biz.organization.id, "byo-model")).toBe(true);
  });

  it("lets a tenant override win over global settings", async () => {
    const { organization } = await createUserAndOrg({
      email: "o@example.com",
      name: "O",
      passwordHash: "h",
      organizationName: "Override Org"
    });
    await ensureFeatureFlagsSeeded();
    await setFeatureFlagEnabled({
      key: "usage-billing",
      enabled: true,
      updatedByUserId: (
        await createUserAndOrg({
          email: "admin2@example.com",
          name: "A2",
          passwordHash: "h",
          organizationName: "Admin 2"
        })
      ).user.id
    });

    // usage-billing is opt_in — still off without override
    expect(await isFeatureEnabledForOrg(organization.id, "usage-billing")).toBe(false);

    await setFeatureFlagTenantOverride({
      flagKey: "usage-billing",
      organizationId: organization.id,
      enabled: true
    });
    expect(await isFeatureEnabledForOrg(organization.id, "usage-billing")).toBe(true);

    const map = await getFeatureFlagsForOrg(organization.id);
    expect(map["usage-billing"]).toBe(true);
  });

  it("lists tenant flag states and clears overrides back to inherit", async () => {
    const { organization } = await createUserAndOrg({
      email: "matrix@example.com",
      name: "M",
      passwordHash: "h",
      organizationName: "Matrix Org"
    });
    await ensureFeatureFlagsSeeded();

    const before = await listTenantFeatureFlagStates(organization.id);
    const usage = before.find((r) => r.flag.key === "usage-billing");
    expect(usage?.override).toBeNull();
    expect(usage?.inherited).toBe(false);
    expect(usage?.effective).toBe(false);

    await setFeatureFlagTenantOverride({
      flagKey: "usage-billing",
      organizationId: organization.id,
      enabled: true
    });
    const forced = await listTenantFeatureFlagStates(organization.id);
    expect(forced.find((r) => r.flag.key === "usage-billing")?.override).toBe(true);
    expect(forced.find((r) => r.flag.key === "usage-billing")?.effective).toBe(true);

    await clearFeatureFlagTenantOverride({
      flagKey: "usage-billing",
      organizationId: organization.id
    });
    const cleared = await listTenantFeatureFlagStates(organization.id);
    expect(cleared.find((r) => r.flag.key === "usage-billing")?.override).toBeNull();
    expect(cleared.find((r) => r.flag.key === "usage-billing")?.effective).toBe(false);
  });
});
