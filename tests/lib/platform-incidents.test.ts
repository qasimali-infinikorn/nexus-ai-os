import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { createUserAndOrg } from "@/lib/db/queries";
import {
  createPlatformIncident,
  countOpenPlatformIncidents,
  resolvePlatformIncident
} from "@/lib/db/platform-incidents";
import { runPlatformHealthChecks } from "@/lib/platform/health";
import {
  auditLog,
  featureFlagTenants,
  featureFlags,
  invitations,
  memberships,
  organizations,
  platformIncidents,
  users
} from "@/lib/db/schema";
import { createTestDb } from "../helpers/testDb";

let testDb: Database;

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-only-encryption-key-do-not-use-in-prod";
  process.env.AUTH_SECRET = "test-only-auth-secret";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test";
  testDb = await createTestDb();
}, 60_000);

beforeEach(async () => {
  __setDbForTests(testDb);
  await testDb.delete(platformIncidents);
  await testDb.delete(featureFlagTenants);
  await testDb.delete(featureFlags);
  await testDb.delete(auditLog);
  await testDb.delete(invitations);
  await testDb.delete(memberships);
  await testDb.delete(users);
  await testDb.delete(organizations);
});

describe("platform incidents", () => {
  it("creates and resolves banners and affects health incidentCount", async () => {
    const { user } = await createUserAndOrg({
      email: "ops@example.com",
      name: "Ops",
      passwordHash: "h",
      organizationName: "Ops Co"
    });

    const before = await runPlatformHealthChecks();
    const baseline = before.incidentCount;

    const incident = await createPlatformIncident({
      title: "Elevated 5xx",
      summary: "API gateway",
      severity: "high",
      createdByUserId: user.id
    });
    expect(await countOpenPlatformIncidents()).toBe(1);

    const mid = await runPlatformHealthChecks();
    expect(mid.openBannerCount).toBe(1);
    expect(mid.incidentCount).toBe(baseline + 1);
    expect(mid.openBanners[0]?.id).toBe(incident.id);
    expect(mid.ok).toBe(false);

    await resolvePlatformIncident({ id: incident.id, resolvedByUserId: user.id });
    expect(await countOpenPlatformIncidents()).toBe(0);

    const after = await runPlatformHealthChecks();
    expect(after.openBannerCount).toBe(0);
    expect(after.incidentCount).toBe(baseline);
  });
});
