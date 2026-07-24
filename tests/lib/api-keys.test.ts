import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { organizations, organizationApiKeys, users } from "@/lib/db/schema";
import {
  createOrgApiKey,
  hashApiKey,
  generateApiKeySecret,
  listOrgApiKeys,
  resolveOrgApiKey,
  revokeOrgApiKey
} from "@/lib/db/api-keys";
import { createTestDb } from "../helpers/testDb";

const ORG_A = "00000000-0000-4000-8000-0000000000a1";
const ORG_B = "00000000-0000-4000-8000-0000000000b2";
const USER = "00000000-0000-4000-8000-000000000099";

let testDb: Database;

beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  __setDbForTests(testDb);
  await testDb.delete(organizationApiKeys);
  await testDb.delete(users);
  await testDb.delete(organizations);
  await testDb.insert(organizations).values([
    { id: ORG_A, name: "Org A", slug: "org-a" },
    { id: ORG_B, name: "Org B", slug: "org-b" }
  ]);
  await testDb.insert(users).values({
    id: USER,
    email: "keys@example.com",
    name: "Keys User",
    passwordHash: "h"
  });
});

afterEach(() => {
  __setDbForTests(null);
});

describe("hashApiKey / generateApiKeySecret", () => {
  it("hashes deterministically and prefixes nx_live_", () => {
    const a = hashApiKey("nx_live_test");
    const b = hashApiKey("nx_live_test");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);

    const secret = generateApiKeySecret();
    expect(secret.plaintext.startsWith("nx_live_")).toBe(true);
    expect(secret.prefix).toBe(secret.plaintext.slice(0, 16));
    expect(secret.hash).toBe(hashApiKey(secret.plaintext));
  });
});

describe("org API keys", () => {
  it("creates, lists, resolves, and revokes within one org", async () => {
    const { key, plaintext } = await createOrgApiKey({
      organizationId: ORG_A,
      name: "CI",
      createdByUserId: USER
    });

    expect(key.keyPrefix.startsWith("nx_live_")).toBe(true);
    expect(key.keyHash).toBe(hashApiKey(plaintext));

    const listed = await listOrgApiKeys(ORG_A);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(key.id);

    const resolved = await resolveOrgApiKey(plaintext);
    expect(resolved).toEqual({ organizationId: ORG_A, keyId: key.id });

    const [updated] = await testDb
      .select()
      .from(organizationApiKeys)
      .where(eq(organizationApiKeys.id, key.id));
    expect(updated.lastUsedAt).toBeTruthy();

    const revoked = await revokeOrgApiKey({ organizationId: ORG_A, keyId: key.id });
    expect(revoked?.revokedAt).toBeTruthy();
    expect(await resolveOrgApiKey(plaintext)).toBeUndefined();
  });

  it("does not resolve keys belonging to another org's hash collision path", async () => {
    const { plaintext: aKey } = await createOrgApiKey({
      organizationId: ORG_A,
      name: "A",
      createdByUserId: USER
    });
    const { plaintext: bKey } = await createOrgApiKey({
      organizationId: ORG_B,
      name: "B",
      createdByUserId: USER
    });

    expect((await resolveOrgApiKey(aKey))?.organizationId).toBe(ORG_A);
    expect((await resolveOrgApiKey(bKey))?.organizationId).toBe(ORG_B);
    expect(await listOrgApiKeys(ORG_A)).toHaveLength(1);
    expect(await listOrgApiKeys(ORG_B)).toHaveLength(1);
  });

  it("ignores non nx_live_ secrets", async () => {
    expect(await resolveOrgApiKey("sk-other")).toBeUndefined();
  });
});
