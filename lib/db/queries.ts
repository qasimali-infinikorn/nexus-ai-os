// Data-access helpers for accounts, organizations, and access control.
// Thin wrappers over Drizzle so route handlers/server actions stay small —
// see lib/db/client.ts for the getDb() lazy-connection pattern these build on.

import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { encryptSecret, decryptSecret, generateToken } from "../crypto";
import {
  users,
  organizations,
  memberships,
  orgProviderKeys,
  invitations,
  auditLog,
  type User,
  type Organization,
  type Membership,
  type MembershipRole,
  type OrgKeyProvider
} from "./schema";

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "org";
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function updateUserName(userId: string, name: string): Promise<void> {
  const db = getDb();
  await db.update(users).set({ name }).where(eq(users.id, userId));
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const db = getDb();
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

async function uniqueSlug(db: ReturnType<typeof getDb>, name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;
  // Small, bounded loop: org creation is low-frequency, a handful of
  // lookups here is cheaper than a fully generic retry-on-conflict.
  while (suffix < 50) {
    const [existing] = await db.select().from(organizations).where(eq(organizations.slug, candidate)).limit(1);
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${generateToken(4)}`;
}

// Signup path: creates the user, a new organization, and an "owner"
// membership in one transaction.
export async function createUserAndOrg(params: {
  email: string;
  name: string;
  passwordHash: string;
  organizationName: string;
}): Promise<{ user: User; organization: Organization; membership: Membership }> {
  const db = getDb();
  // Resolved before opening the transaction: PGlite (used in tests) serves
  // one connection at a time, so a query against the outer `db` while a
  // `db.transaction()` is open on that same connection deadlocks. The tiny
  // race this leaves (two signups picking the same slug at once) is caught
  // by organizations.slug's unique index instead of prevented outright.
  const slug = await uniqueSlug(db, params.organizationName);

  return db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({ name: params.organizationName, slug })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        email: params.email.toLowerCase(),
        name: params.name,
        passwordHash: params.passwordHash
      })
      .returning();

    const [membership] = await tx
      .insert(memberships)
      .values({ userId: user.id, organizationId: organization.id, role: "owner" })
      .returning();

    return { user, organization, membership };
  });
}

export async function getMembership(userId: string, organizationId: string): Promise<Membership | undefined> {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId)))
    .limit(1);
  return membership;
}

// A user's memberships plus the organization each belongs to — used to
// resolve which org a freshly-authenticated session should default into.
export async function listMembershipsForUser(
  userId: string
): Promise<{ membership: Membership; organization: Organization }[]> {
  const db = getDb();
  const rows = await db
    .select({ membership: memberships, organization: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId));
  return rows;
}

export async function listOrgMembers(
  organizationId: string
): Promise<{ membership: Membership; user: User }[]> {
  const db = getDb();
  const rows = await db
    .select({ membership: memberships, user: users })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.organizationId, organizationId));
  return rows;
}

export async function getOrganizationById(id: string): Promise<Organization | undefined> {
  const db = getDb();
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return organization;
}

// Returns the decrypted plaintext key, or undefined if the org hasn't
// configured that provider. Callers must never log/return this value to
// the client verbatim.
export async function getOrgProviderKey(
  organizationId: string,
  provider: OrgKeyProvider
): Promise<string | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(orgProviderKeys)
    .where(and(eq(orgProviderKeys.organizationId, organizationId), eq(orgProviderKeys.provider, provider)))
    .limit(1);
  if (!row) return undefined;
  return decryptSecret(row.encryptedKey);
}

export async function listOrgProviderKeyStatus(
  organizationId: string
): Promise<{ provider: OrgKeyProvider; configured: boolean; updatedAt: Date | null }[]> {
  const db = getDb();
  const rows = await db
    .select({ provider: orgProviderKeys.provider, updatedAt: orgProviderKeys.updatedAt })
    .from(orgProviderKeys)
    .where(eq(orgProviderKeys.organizationId, organizationId));
  const byProvider = new Map(rows.map((r) => [r.provider, r.updatedAt]));
  const allProviders: OrgKeyProvider[] = ["openai", "anthropic", "google"];
  return allProviders.map((provider) => ({
    provider,
    configured: byProvider.has(provider),
    updatedAt: byProvider.get(provider) ?? null
  }));
}

export async function setOrgProviderKey(params: {
  organizationId: string;
  provider: OrgKeyProvider;
  plaintextKey: string;
  updatedByUserId: string;
}): Promise<void> {
  const db = getDb();
  const encryptedKey = encryptSecret(params.plaintextKey);
  await db
    .insert(orgProviderKeys)
    .values({
      organizationId: params.organizationId,
      provider: params.provider,
      encryptedKey,
      updatedByUserId: params.updatedByUserId
    })
    .onConflictDoUpdate({
      target: [orgProviderKeys.organizationId, orgProviderKeys.provider],
      set: { encryptedKey, updatedByUserId: params.updatedByUserId, updatedAt: new Date() }
    });
}

export async function deleteOrgProviderKey(organizationId: string, provider: OrgKeyProvider): Promise<void> {
  const db = getDb();
  await db
    .delete(orgProviderKeys)
    .where(and(eq(orgProviderKeys.organizationId, organizationId), eq(orgProviderKeys.provider, provider)));
}

export async function createInvitation(params: {
  organizationId: string;
  email: string;
  role: MembershipRole;
  invitedByUserId: string;
}): Promise<{ token: string }> {
  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(invitations).values({
    organizationId: params.organizationId,
    email: params.email.toLowerCase(),
    role: params.role,
    token,
    invitedByUserId: params.invitedByUserId,
    expiresAt
  });
  return { token };
}

export async function getInvitationByToken(token: string) {
  const db = getDb();
  const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return invitation;
}

// Accepts an invitation for an existing or newly-created user, creating the
// membership and marking the invitation used. Idempotent on re-acceptance
// of an already-accepted token (returns without creating a duplicate
// membership) rather than throwing.
export async function acceptInvitation(token: string, userId: string): Promise<Membership | undefined> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [invitation] = await tx.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    if (!invitation) return undefined;
    if (invitation.expiresAt < new Date()) return undefined;

    // Check for an existing membership FIRST — this is what makes
    // re-acceptance idempotent, since by the second call `acceptedAt` is
    // already set and would otherwise look indistinguishable from "someone
    // else's already-used invitation."
    const [existing] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, invitation.organizationId)))
      .limit(1);
    if (existing) {
      if (!invitation.acceptedAt) {
        await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invitation.id));
      }
      return existing;
    }

    // No existing membership for this user, and the invitation was already
    // claimed (presumably by someone else, or this token was reused) —
    // refuse rather than minting a second membership off one invitation.
    if (invitation.acceptedAt) return undefined;

    const [membership] = await tx
      .insert(memberships)
      .values({ userId, organizationId: invitation.organizationId, role: invitation.role })
      .returning();
    await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invitation.id));
    return membership;
  });
}

export async function writeAuditLog(entry: {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.insert(auditLog).values({
    organizationId: entry.organizationId ?? null,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata
  });
}
