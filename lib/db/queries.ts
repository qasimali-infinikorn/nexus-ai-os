// Data-access helpers for accounts, organizations, and access control.
// Thin wrappers over Drizzle so route handlers/server actions stay small —
// see lib/db/client.ts for the getDb() lazy-connection pattern these build on.

import { and, asc, desc, eq, gte, isNull, like, max, sql } from "drizzle-orm";
import { getDb } from "./client";
import { encryptSecret, decryptSecret, generateToken } from "../crypto";
import {
  users,
  organizations,
  memberships,
  orgProviderKeys,
  invitations,
  passwordResetTokens,
  auditLog,
  projectTasks,
  projects,
  userSettings,
  type User,
  type Organization,
  type Membership,
  type MembershipRole,
  type OrgKeyProvider,
  type OrganizationPlanTier,
  type OrganizationStatus,
  type ProjectTask,
  type TaskStatus,
  type TaskSource,
  type Project,
  type ProjectStatus,
  type AuditLogEntry,
  type PasswordResetToken
} from "./schema";
// Aliased: `projects` is the Drizzle table above; these are the seed rows.
import { boardTaskSeeds, projects as projectSeeds } from "../workspace/content";

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
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));
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

/** Platform-admin Overview: live org counts + plan mix. Revenue KPIs stay unset until billing lands. */
export async function getPlatformOverviewStats(): Promise<{
  tenantCount: number;
  activeCount: number;
  trialCount: number;
  pastDueCount: number;
  suspendedCount: number;
  planMix: { plan: string; count: number }[];
}> {
  const db = getDb();

  const [totals] = await db
    .select({
      tenantCount: sql<number>`count(*)::int`,
      activeCount: sql<number>`count(*) filter (where ${organizations.status} = 'active')::int`,
      trialCount: sql<number>`count(*) filter (where ${organizations.status} = 'trial')::int`,
      pastDueCount: sql<number>`count(*) filter (where ${organizations.status} = 'past_due')::int`,
      suspendedCount: sql<number>`count(*) filter (where ${organizations.status} = 'suspended')::int`
    })
    .from(organizations);

  const planRows = await db
    .select({
      plan: organizations.planTier,
      count: sql<number>`count(*)::int`
    })
    .from(organizations)
    .groupBy(organizations.planTier)
    .orderBy(asc(organizations.planTier));

  return {
    tenantCount: totals?.tenantCount ?? 0,
    activeCount: totals?.activeCount ?? 0,
    trialCount: totals?.trialCount ?? 0,
    pastDueCount: totals?.pastDueCount ?? 0,
    suspendedCount: totals?.suspendedCount ?? 0,
    planMix: planRows.map((r) => ({ plan: r.plan, count: r.count }))
  };
}

export async function setUserPlatformAdmin(email: string, enabled: boolean): Promise<User | undefined> {
  const db = getDb();
  const [user] = await db
    .update(users)
    .set({ isPlatformAdmin: enabled })
    .where(eq(users.email, email.toLowerCase()))
    .returning();
  return user;
}

export type TenantAdminFilter = "all" | OrganizationStatus;

export type TenantAdminRow = {
  id: string;
  name: string;
  slug: string;
  planTier: OrganizationPlanTier;
  status: OrganizationStatus;
  seatCount: number;
  mrrCents: number | null;
  createdAt: Date;
  lastActiveAt: Date | null;
};

/** Superadmin tenant table: orgs + seat counts + latest org-scoped audit activity. */
export async function listTenantsForAdmin(filter: TenantAdminFilter = "all"): Promise<TenantAdminRow[]> {
  const db = getDb();
  const statusFilter = filter === "all" ? undefined : eq(organizations.status, filter);

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      planTier: organizations.planTier,
      status: organizations.status,
      mrrCents: organizations.mrrCents,
      createdAt: organizations.createdAt,
      seatCount: sql<number>`count(distinct ${memberships.id})::int`,
      lastActiveAt: sql<Date | null>`max(${auditLog.createdAt})`
    })
    .from(organizations)
    .leftJoin(memberships, eq(memberships.organizationId, organizations.id))
    .leftJoin(auditLog, eq(auditLog.organizationId, organizations.id))
    .where(statusFilter)
    .groupBy(organizations.id)
    .orderBy(desc(organizations.createdAt));

  return rows;
}

export async function getTenantDetailForAdmin(organizationId: string): Promise<
  | {
      organization: Organization;
      members: { id: string; name: string; email: string; role: MembershipRole; createdAt: Date }[];
      pendingInvites: number;
    }
  | undefined
> {
  const organization = await getOrganizationById(organizationId);
  if (!organization) return undefined;

  const db = getDb();
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      createdAt: memberships.createdAt
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(asc(memberships.createdAt));

  const [inviteCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invitations)
    .where(and(eq(invitations.organizationId, organizationId), isNull(invitations.acceptedAt)));

  return {
    organization,
    members,
    pendingInvites: inviteCount?.count ?? 0
  };
}

export async function setOrganizationStatus(
  organizationId: string,
  status: OrganizationStatus
): Promise<Organization | undefined> {
  const db = getDb();
  const [organization] = await db
    .update(organizations)
    .set({ status })
    .where(eq(organizations.id, organizationId))
    .returning();
  return organization;
}

export async function createOrganizationAsAdmin(params: {
  name: string;
  planTier: OrganizationPlanTier;
  status: OrganizationStatus;
}): Promise<Organization> {
  const db = getDb();
  const slug = await uniqueSlug(db, params.name);
  const [organization] = await db
    .insert(organizations)
    .values({
      name: params.name,
      slug,
      planTier: params.planTier,
      status: params.status
    })
    .returning();
  return organization;
}

/**
 * Platform-scoped audit rows live in `audit_log` with `organization_id` null
 * (see schema comment). Prefer action names prefixed with `platform.`.
 */
export async function writePlatformAuditEvent(entry: {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await writeAuditLog({
    organizationId: null,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata
  });
}

export type PlatformAuditEvent = AuditLogEntry & {
  actorName: string | null;
  actorEmail: string | null;
};

export async function listPlatformAuditEvents(params?: {
  limit?: number;
  action?: string;
  actionPrefix?: string;
}): Promise<PlatformAuditEvent[]> {
  const db = getDb();
  const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
  const conditions = [isNull(auditLog.organizationId)];
  if (params?.action) {
    conditions.push(eq(auditLog.action, params.action));
  } else if (params?.actionPrefix) {
    conditions.push(like(auditLog.action, `${params.actionPrefix}%`));
  }

  const rows = await db
    .select({
      id: auditLog.id,
      organizationId: auditLog.organizationId,
      actorUserId: auditLog.actorUserId,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorName: users.name,
      actorEmail: users.email
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return rows;
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

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Creates a fresh reset token; invalidates unused prior tokens for the user. */
export async function createPasswordResetToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  await db.insert(passwordResetTokens).values({
    userId,
    token,
    expiresAt
  });

  return { token, expiresAt };
}

export async function getPasswordResetByToken(
  token: string
): Promise<(PasswordResetToken & { userEmail: string }) | undefined> {
  const db = getDb();
  const [row] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      token: passwordResetTokens.token,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
      createdAt: passwordResetTokens.createdAt,
      userEmail: users.email
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  return row;
}

/** Marks token used and updates password in one transaction. */
export async function consumePasswordResetToken(params: {
  token: string;
  passwordHash: string;
}): Promise<{ userId: string } | undefined> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, params.token))
      .limit(1);
    if (!row) return undefined;
    if (row.usedAt) return undefined;
    if (row.expiresAt < new Date()) return undefined;

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id));

    await tx
      .update(users)
      .set({ passwordHash: params.passwordHash })
      .where(eq(users.id, row.userId));

    // Invalidate any other outstanding tokens for this user.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)));

    return { userId: row.userId };
  });
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


/* ── Project tasks (Kanban board) ─────────────────────────────────────── */

const TASK_ORDER = [asc(projectTasks.sortOrder), asc(projectTasks.createdAt)] as const;

function taskScope(organizationId: string, projectSlug: string) {
  return and(eq(projectTasks.organizationId, organizationId), eq(projectTasks.projectSlug, projectSlug));
}

/**
 * Lists a project's tasks, seeding the demo board the first time an
 * organization opens it. Seeding lazily (rather than at signup) means
 * organizations created before this feature existed also get a populated
 * board, and `onConflictDoNothing` on the org+ref unique index keeps it
 * idempotent if two requests race.
 */
export async function listProjectTasks(organizationId: string, projectSlug: string): Promise<ProjectTask[]> {
  const db = getDb();
  const read = () =>
    db.select().from(projectTasks).where(taskScope(organizationId, projectSlug)).orderBy(...TASK_ORDER);

  const existing = await read();
  if (existing.length > 0 || projectSlug !== "order-platform") return existing;

  await db
    .insert(projectTasks)
    .values(
      boardTaskSeeds.map((t, i) => ({
        organizationId,
        projectSlug,
        ref: t.ref,
        kind: t.kind,
        title: t.title,
        description: t.description || null,
        status: t.status,
        priority: t.priority,
        points: t.points,
        assignee: t.assignee,
        avatarIndex: t.avatarIndex,
        startDay: t.startDay,
        endDay: t.endDay,
        sortOrder: i
      }))
    )
    .onConflictDoNothing();

  return read();
}

export async function getProjectTask(organizationId: string, ref: string): Promise<ProjectTask | undefined> {
  const db = getDb();
  const [task] = await db
    .select()
    .from(projectTasks)
    .where(and(eq(projectTasks.organizationId, organizationId), eq(projectTasks.ref, ref)))
    .limit(1);
  return task;
}

export async function getProjectTaskByExternalId(
  organizationId: string,
  externalId: string
): Promise<ProjectTask | undefined> {
  const db = getDb();
  const [task] = await db
    .select()
    .from(projectTasks)
    .where(
      and(eq(projectTasks.organizationId, organizationId), eq(projectTasks.externalId, externalId))
    )
    .limit(1);
  return task;
}

/**
 * Create or update a board task from an external tracker (Jira / GitHub).
 * Idempotent on `(organizationId, externalId)`.
 */
export async function upsertExternalProjectTask(params: {
  organizationId: string;
  projectSlug: string;
  source: TaskSource;
  externalId: string;
  externalUrl?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  kind?: ProjectTask["kind"];
  priority?: ProjectTask["priority"];
  preferredRef?: string;
}): Promise<ProjectTask> {
  const existing = await getProjectTaskByExternalId(params.organizationId, params.externalId);
  if (existing) {
    const db = getDb();
    const [updated] = await db
      .update(projectTasks)
      .set({
        title: params.title.slice(0, 200),
        description: params.description?.slice(0, 5000) ?? existing.description,
        status: params.status,
        externalUrl: params.externalUrl ?? existing.externalUrl,
        kind: params.kind ?? existing.kind,
        priority: params.priority ?? existing.priority,
        updatedAt: new Date()
      })
      .where(eq(projectTasks.id, existing.id))
      .returning();
    return updated;
  }

  const db = getDb();
  const preferred = params.preferredRef?.trim();
  let ref = preferred && preferred.length > 0 ? preferred.slice(0, 40) : "";
  if (ref) {
    const clash = await getProjectTask(params.organizationId, ref);
    if (clash) ref = "";
  }
  if (!ref) {
    const prefix = (params.preferredRef?.split("-")[0] || params.projectSlug.slice(0, 3) || "NX").toUpperCase();
    ref = await nextTaskRef(params.organizationId, params.projectSlug, prefix.replace(/[^A-Z0-9]/g, "") || "NX");
  }

  const [{ value: highestOrder }] = await db
    .select({ value: max(projectTasks.sortOrder) })
    .from(projectTasks)
    .where(and(taskScope(params.organizationId, params.projectSlug), eq(projectTasks.status, params.status)));

  const [task] = await db
    .insert(projectTasks)
    .values({
      organizationId: params.organizationId,
      projectSlug: params.projectSlug,
      ref,
      kind: params.kind ?? "task",
      title: params.title.slice(0, 200),
      description: params.description?.slice(0, 5000) ?? null,
      status: params.status,
      priority: params.priority ?? "Med",
      points: 1,
      assignee: "—",
      avatarIndex: 0,
      startDay: 1,
      endDay: 2,
      sortOrder: (highestOrder ?? -1) + 1,
      source: params.source,
      externalId: params.externalId,
      externalUrl: params.externalUrl ?? null
    })
    .returning();
  return task;
}

/** Next sequential ref for a project, e.g. NX-2141 -> NX-2142. */
async function nextTaskRef(organizationId: string, projectSlug: string, prefix: string): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ ref: projectTasks.ref })
    .from(projectTasks)
    .where(taskScope(organizationId, projectSlug));
  // Floor of 100 so a brand-new project starts at KEY-101; a project that
  // already has tickets simply continues from its highest existing number.
  const highest = rows.reduce((acc, r) => {
    const n = Number(r.ref.split("-")[1]);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 100);
  return `${prefix}-${highest + 1}`;
}

export async function createProjectTask(params: {
  organizationId: string;
  projectSlug: string;
  refPrefix: string;
  kind: ProjectTask["kind"];
  title: string;
  description?: string;
  status: TaskStatus;
  priority: ProjectTask["priority"];
  points: number;
  assignee: string;
  avatarIndex: number;
}): Promise<ProjectTask> {
  const db = getDb();
  const ref = await nextTaskRef(params.organizationId, params.projectSlug, params.refPrefix);
  const [{ value: highestOrder }] = await db
    .select({ value: max(projectTasks.sortOrder) })
    .from(projectTasks)
    .where(and(taskScope(params.organizationId, params.projectSlug), eq(projectTasks.status, params.status)));

  const [task] = await db
    .insert(projectTasks)
    .values({
      organizationId: params.organizationId,
      projectSlug: params.projectSlug,
      ref,
      kind: params.kind,
      title: params.title,
      description: params.description || null,
      status: params.status,
      priority: params.priority,
      points: params.points,
      assignee: params.assignee,
      avatarIndex: params.avatarIndex,
      startDay: 1,
      endDay: 2,
      sortOrder: (highestOrder ?? -1) + 1
    })
    .returning();
  return task;
}

/**
 * Moves a task to `status`, inserting it at `position` within that column.
 * Siblings at or after the insertion point shift down so the ordering
 * survives a reload — the board is persisted, not just optimistic state.
 */
export async function moveProjectTask(params: {
  organizationId: string;
  ref: string;
  status: TaskStatus;
  position: number;
}): Promise<ProjectTask | undefined> {
  const db = getDb();
  const task = await getProjectTask(params.organizationId, params.ref);
  if (!task) return undefined;

  return db.transaction(async (tx) => {
    await tx
      .update(projectTasks)
      .set({ sortOrder: sql`${projectTasks.sortOrder} + 1` })
      .where(
        and(
          eq(projectTasks.organizationId, params.organizationId),
          eq(projectTasks.projectSlug, task.projectSlug),
          eq(projectTasks.status, params.status),
          gte(projectTasks.sortOrder, params.position)
        )
      );

    const [updated] = await tx
      .update(projectTasks)
      .set({ status: params.status, sortOrder: params.position, updatedAt: new Date() })
      .where(eq(projectTasks.id, task.id))
      .returning();
    return updated;
  });
}

export async function updateProjectTask(params: {
  organizationId: string;
  ref: string;
  title?: string;
  description?: string;
  priority?: ProjectTask["priority"];
  points?: number;
  status?: TaskStatus;
  assignee?: string;
}): Promise<ProjectTask | undefined> {
  const { organizationId, ref, ...fields } = params;
  const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return getProjectTask(organizationId, ref);

  const db = getDb();
  const [updated] = await db
    .update(projectTasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(projectTasks.organizationId, organizationId), eq(projectTasks.ref, ref)))
    .returning();
  return updated;
}

/* ── Projects ─────────────────────────────────────────────────────────── */

/**
 * Lists an organization's projects, seeding the demo portfolio the first
 * time it is opened (same lazy pattern as listProjectTasks, so orgs created
 * before this table existed also get populated).
 */
export async function listProjects(organizationId: string): Promise<Project[]> {
  const db = getDb();
  const read = () =>
    db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(asc(projects.sortOrder), asc(projects.createdAt));

  const existing = await read();
  if (existing.length > 0) return existing;

  await db
    .insert(projects)
    .values(
      projectSeeds.map((p, i) => ({
        organizationId,
        slug: p.slug,
        name: p.name,
        key: p.key,
        initials: p.initials,
        avatarIndex: p.avatarIndex,
        accent: p.accent,
        lead: p.lead,
        status: p.status,
        sprintLabel: p.sprint,
        progress: p.progress,
        openIssues: p.openIssues,
        engineers: p.engineers,
        warning: p.warning ?? null,
        sortOrder: i
      }))
    )
    .onConflictDoNothing();

  return read();
}

export async function getProjectBySlug(organizationId: string, slug: string): Promise<Project | undefined> {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.slug, slug)))
    .limit(1);
  return project;
}

/** Ensures a slug is unique within the organization by suffixing -2, -3, … */
async function uniqueProjectSlug(organizationId: string, base: string): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${generateToken(4)}`;
}

const PROJECT_ACCENTS = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#ea580c", "#0891b2"];

export async function createProject(params: {
  organizationId: string;
  name: string;
  key: string;
  lead: string;
  status: ProjectStatus;
  sprintLabel: string;
  engineers: number;
}): Promise<Project> {
  const db = getDb();
  const slug = await uniqueProjectSlug(params.organizationId, slugify(params.name));

  const [{ value: highestOrder }] = await db
    .select({ value: max(projects.sortOrder) })
    .from(projects)
    .where(eq(projects.organizationId, params.organizationId));

  const initials = params.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const avatarIndex = Math.abs([...params.key].reduce((a, c) => a + c.charCodeAt(0), 0)) % 6;

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: params.organizationId,
      slug,
      name: params.name,
      key: params.key.toUpperCase(),
      initials: initials || "PR",
      avatarIndex,
      accent: PROJECT_ACCENTS[avatarIndex],
      lead: params.lead,
      status: params.status,
      sprintLabel: params.sprintLabel,
      progress: 0,
      openIssues: 0,
      engineers: params.engineers,
      sortOrder: (highestOrder ?? -1) + 1
    })
    .returning();
  return project;
}

/* ── User settings & workspace ────────────────────────────────────────── */

export type NotificationPrefs = Record<string, { inApp: boolean; email: boolean; slack: boolean }>;
export type AppearancePrefs = Record<string, boolean>;
export type DeliveryPrefs = { slackWebhookUrl?: string };

export async function getUserSettings(
  userId: string,
  organizationId: string
): Promise<{ notificationPrefs: NotificationPrefs; appearance: AppearancePrefs; delivery: DeliveryPrefs }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userSettings)
    .where(and(eq(userSettings.userId, userId), eq(userSettings.organizationId, organizationId)))
    .limit(1);
  return {
    notificationPrefs: (row?.notificationPrefs as NotificationPrefs) ?? {},
    appearance: (row?.appearance as AppearancePrefs) ?? {},
    delivery: (row?.delivery as DeliveryPrefs) ?? {}
  };
}

export async function saveUserSettings(params: {
  userId: string;
  organizationId: string;
  notificationPrefs?: NotificationPrefs;
  appearance?: AppearancePrefs;
  delivery?: DeliveryPrefs;
}): Promise<void> {
  const db = getDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (params.notificationPrefs) patch.notificationPrefs = params.notificationPrefs;
  if (params.appearance) patch.appearance = params.appearance;
  if (params.delivery) patch.delivery = params.delivery;

  await db
    .insert(userSettings)
    .values({
      userId: params.userId,
      organizationId: params.organizationId,
      notificationPrefs: params.notificationPrefs ?? {},
      appearance: params.appearance ?? {},
      delivery: params.delivery ?? {}
    })
    .onConflictDoUpdate({ target: [userSettings.userId, userSettings.organizationId], set: patch });
}

export async function updateOrganizationName(organizationId: string, name: string): Promise<void> {
  const db = getDb();
  await db.update(organizations).set({ name }).where(eq(organizations.id, organizationId));
}
