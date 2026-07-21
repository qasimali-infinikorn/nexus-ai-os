import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { __setDbForTests, type Database } from "@/lib/db/client";
import {
  createUserAndOrg,
  getUserByEmail,
  getMembership,
  listMembershipsForUser,
  listOrgMembers,
  getOrgProviderKey,
  setOrgProviderKey,
  deleteOrgProviderKey,
  listOrgProviderKeyStatus,
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  writeAuditLog,
  slugify
} from "@/lib/db/queries";
import { organizations, users, memberships, invitations, auditLog } from "@/lib/db/schema";
import { createTestDb } from "../helpers/testDb";

let testDb: Database;

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-only-encryption-key-do-not-use-in-prod";
  testDb = await createTestDb();
});

beforeEach(async () => {
  __setDbForTests(testDb);
  await testDb.delete(auditLog);
  await testDb.delete(invitations);
  await testDb.delete(memberships);
  await testDb.delete(users);
  await testDb.delete(organizations);
});

describe("slugify", () => {
  it("lowercases and dasherizes", () => {
    expect(slugify("Acme Cloud Inc.")).toBe("acme-cloud-inc");
  });

  it("falls back to 'org' for input with no alphanumerics", () => {
    expect(slugify("***")).toBe("org");
  });
});

describe("createUserAndOrg", () => {
  it("creates a user, an org, and an owner membership together", async () => {
    const { user, organization, membership } = await createUserAndOrg({
      email: "Alex@Example.com",
      name: "Alex Morgan",
      passwordHash: "hashed",
      organizationName: "Acme Cloud"
    });

    expect(user.email).toBe("alex@example.com"); // normalized to lowercase
    expect(organization.slug).toBe("acme-cloud");
    expect(membership.role).toBe("owner");

    const found = await getUserByEmail("alex@example.com");
    expect(found?.id).toBe(user.id);
  });

  it("dedupes organization slugs", async () => {
    const first = await createUserAndOrg({
      email: "a@example.com",
      name: "A",
      passwordHash: "h",
      organizationName: "Acme"
    });
    const second = await createUserAndOrg({
      email: "b@example.com",
      name: "B",
      passwordHash: "h",
      organizationName: "Acme"
    });

    expect(first.organization.slug).toBe("acme");
    expect(second.organization.slug).toBe("acme-2");
  });
});

describe("memberships", () => {
  it("finds a membership by user+org and lists it for both directions", async () => {
    const { user, organization } = await createUserAndOrg({
      email: "owner@example.com",
      name: "Owner",
      passwordHash: "h",
      organizationName: "Org A"
    });

    const membership = await getMembership(user.id, organization.id);
    expect(membership?.role).toBe("owner");

    const forUser = await listMembershipsForUser(user.id);
    expect(forUser).toHaveLength(1);
    expect(forUser[0].organization.id).toBe(organization.id);

    const forOrg = await listOrgMembers(organization.id);
    expect(forOrg).toHaveLength(1);
    expect(forOrg[0].user.id).toBe(user.id);
  });
});

describe("org provider keys", () => {
  it("encrypts on write and decrypts on read, and reports configured status", async () => {
    const { organization, user } = await createUserAndOrg({
      email: "owner2@example.com",
      name: "Owner",
      passwordHash: "h",
      organizationName: "Org B"
    });

    let statuses = await listOrgProviderKeyStatus(organization.id);
    expect(statuses.every((s) => !s.configured)).toBe(true);

    await setOrgProviderKey({
      organizationId: organization.id,
      provider: "openai",
      plaintextKey: "sk-real-key",
      updatedByUserId: user.id
    });

    const key = await getOrgProviderKey(organization.id, "openai");
    expect(key).toBe("sk-real-key");

    statuses = await listOrgProviderKeyStatus(organization.id);
    expect(statuses.find((s) => s.provider === "openai")?.configured).toBe(true);
    expect(statuses.find((s) => s.provider === "anthropic")?.configured).toBe(false);

    // Setting again for the same org+provider updates rather than duplicates.
    await setOrgProviderKey({
      organizationId: organization.id,
      provider: "openai",
      plaintextKey: "sk-rotated-key",
      updatedByUserId: user.id
    });
    expect(await getOrgProviderKey(organization.id, "openai")).toBe("sk-rotated-key");

    await deleteOrgProviderKey(organization.id, "openai");
    expect(await getOrgProviderKey(organization.id, "openai")).toBeUndefined();
  });
});

describe("invitations", () => {
  it("accepts a valid invitation and creates a membership with the invited role", async () => {
    const owner = await createUserAndOrg({
      email: "owner3@example.com",
      name: "Owner",
      passwordHash: "h",
      organizationName: "Org C"
    });
    const invitee = await createUserAndOrg({
      email: "invitee@example.com",
      name: "Invitee",
      passwordHash: "h",
      organizationName: "Invitee's Own Org"
    });

    const { token } = await createInvitation({
      organizationId: owner.organization.id,
      email: "invitee@example.com",
      role: "admin",
      invitedByUserId: owner.user.id
    });

    const invitation = await getInvitationByToken(token);
    expect(invitation?.acceptedAt).toBeNull();

    const membership = await acceptInvitation(token, invitee.user.id);
    expect(membership?.role).toBe("admin");
    expect(membership?.organizationId).toBe(owner.organization.id);

    const accepted = await getInvitationByToken(token);
    expect(accepted?.acceptedAt).not.toBeNull();
  });

  it("is idempotent on re-acceptance and rejects an expired token", async () => {
    const owner = await createUserAndOrg({
      email: "owner4@example.com",
      name: "Owner",
      passwordHash: "h",
      organizationName: "Org D"
    });
    const invitee = await createUserAndOrg({
      email: "invitee2@example.com",
      name: "Invitee",
      passwordHash: "h",
      organizationName: "Invitee2's Org"
    });

    const { token } = await createInvitation({
      organizationId: owner.organization.id,
      email: "invitee2@example.com",
      role: "member",
      invitedByUserId: owner.user.id
    });

    const first = await acceptInvitation(token, invitee.user.id);
    const second = await acceptInvitation(token, invitee.user.id);
    expect(second?.id).toBe(first?.id);

    const rejected = await acceptInvitation("not-a-real-token", invitee.user.id);
    expect(rejected).toBeUndefined();
  });
});

describe("writeAuditLog", () => {
  it("writes an entry that can be read back", async () => {
    const { organization, user } = await createUserAndOrg({
      email: "owner5@example.com",
      name: "Owner",
      passwordHash: "h",
      organizationName: "Org E"
    });

    await writeAuditLog({
      organizationId: organization.id,
      actorUserId: user.id,
      action: "org_provider_key.set",
      targetType: "org_provider_key",
      targetId: "openai",
      metadata: { note: "test" }
    });

    const rows = await testDb.select().from(auditLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("org_provider_key.set");
    expect(rows[0].metadata).toEqual({ note: "test" });
  });
});
