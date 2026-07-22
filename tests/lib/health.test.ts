import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { runPlatformHealthChecks } from "@/lib/platform/health";
import { createTestDb } from "../helpers/testDb";
import { organizations, users, memberships, invitations, auditLog, featureFlags, featureFlagTenants, platformIncidents } from "@/lib/db/schema";

let testDb: Database;

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-only-encryption-key-do-not-use-in-prod";
  process.env.AUTH_SECRET = "test-only-auth-secret";
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

describe("runPlatformHealthChecks", () => {
  it("reports healthy postgres when the test DB is wired", async () => {
    const report = await runPlatformHealthChecks();
    const postgres = report.checks.find((c) => c.id === "postgres");
    expect(postgres?.status).toBe("healthy");
    expect(postgres?.latencyMs).toBeTypeOf("number");
  });

  it("flags missing AUTH_SECRET as an auth incident", async () => {
    const prev = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try {
      const report = await runPlatformHealthChecks();
      const auth = report.checks.find((c) => c.id === "auth");
      expect(auth?.status).toBe("down");
      expect(report.ok).toBe(false);
      expect(report.incidentCount).toBeGreaterThan(0);
    } finally {
      process.env.AUTH_SECRET = prev;
    }
  });

  it("includes the expected probe set", async () => {
    const report = await runPlatformHealthChecks();
    const ids = report.checks.map((c) => c.id).sort();
    expect(ids).toEqual(["auth", "embeddings", "encryption", "orchestrate", "postgres"]);
  });
});
