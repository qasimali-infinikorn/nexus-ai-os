import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import {
  agentRuns,
  deployments,
  incidents,
  meetingActionItems,
  meetings,
  notifications,
  projectTasks,
  type AgentRun,
  type AgentRunStatus,
  type Deployment,
  type DeploymentStatus,
  type Incident,
  type IncidentSeverity,
  type Meeting,
  type MeetingActionItem,
  type Notification,
  type NotificationKind
} from "./schema";

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/* ── Notifications ───────────────────────────────────────────────────── */

export async function listNotificationsForUser(params: {
  organizationId: string;
  userId: string;
  kind?: NotificationKind | "All";
  limit?: number;
}): Promise<(Notification & { ago: string })[]> {
  const db = getDb();
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const visibility = or(
    isNull(notifications.userId),
    eq(notifications.userId, params.userId)
  );
  const kindFilter =
    params.kind && params.kind !== "All" ? eq(notifications.kind, params.kind) : undefined;

  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.organizationId, params.organizationId), visibility, kindFilter))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, ago: relativeTime(row.createdAt) }));
}

export async function countUnreadNotifications(organizationId: string, userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.unread, true),
        or(isNull(notifications.userId), eq(notifications.userId, userId))
      )
    );
  return row?.count ?? 0;
}

export async function createNotification(params: {
  organizationId: string;
  userId?: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  tone?: string;
  badge?: string;
}): Promise<Notification> {
  const db = getDb();
  const [row] = await db
    .insert(notifications)
    .values({
      organizationId: params.organizationId,
      userId: params.userId ?? null,
      kind: params.kind,
      title: params.title,
      body: params.body,
      href: params.href ?? "/notifications",
      tone: params.tone ?? "slate",
      badge: params.badge
    })
    .returning();
  return row;
}

export async function markAllNotificationsRead(organizationId: string, userId: string): Promise<number> {
  const db = getDb();
  const updated = await db
    .update(notifications)
    .set({ unread: false })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.unread, true),
        or(isNull(notifications.userId), eq(notifications.userId, userId))
      )
    )
    .returning({ id: notifications.id });
  return updated.length;
}

export async function markNotificationRead(params: {
  organizationId: string;
  userId: string;
  notificationId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(notifications)
    .set({ unread: false })
    .where(
      and(
        eq(notifications.id, params.notificationId),
        eq(notifications.organizationId, params.organizationId),
        or(isNull(notifications.userId), eq(notifications.userId, params.userId))
      )
    );
}

/* ── Meetings ────────────────────────────────────────────────────────── */

export async function listMeetings(organizationId: string, limit = 20): Promise<Meeting[]> {
  const db = getDb();
  return db
    .select()
    .from(meetings)
    .where(eq(meetings.organizationId, organizationId))
    .orderBy(asc(meetings.startsAt))
    .limit(limit);
}

export async function getMeeting(organizationId: string, meetingId: string): Promise<Meeting | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.organizationId, organizationId)))
    .limit(1);
  return row;
}

export async function createMeeting(params: {
  organizationId: string;
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string;
  kind?: string;
  attendees?: string[];
  needsPrep?: boolean;
}): Promise<Meeting> {
  const db = getDb();
  const [row] = await db
    .insert(meetings)
    .values({
      organizationId: params.organizationId,
      title: params.title,
      startsAt: params.startsAt,
      endsAt: params.endsAt ?? null,
      location: params.location,
      kind: params.kind ?? "internal",
      attendees: params.attendees ?? [],
      needsPrep: params.needsPrep ?? true,
      source: "manual"
    })
    .returning();
  return row;
}

export async function saveMeetingAgenda(params: {
  organizationId: string;
  meetingId: string;
  agenda: string;
}): Promise<Meeting | undefined> {
  const db = getDb();
  const [row] = await db
    .update(meetings)
    .set({ agenda: params.agenda, needsPrep: false, updatedAt: new Date() })
    .where(and(eq(meetings.id, params.meetingId), eq(meetings.organizationId, params.organizationId)))
    .returning();
  return row;
}

export async function listMeetingActionItems(
  organizationId: string,
  meetingId?: string
): Promise<MeetingActionItem[]> {
  const db = getDb();
  const conditions = [eq(meetingActionItems.organizationId, organizationId)];
  if (meetingId) conditions.push(eq(meetingActionItems.meetingId, meetingId));
  return db
    .select()
    .from(meetingActionItems)
    .where(and(...conditions))
    .orderBy(asc(meetingActionItems.sortOrder), asc(meetingActionItems.createdAt));
}

export async function createMeetingActionItem(params: {
  organizationId: string;
  meetingId: string;
  text: string;
  owner?: string;
}): Promise<MeetingActionItem> {
  const db = getDb();
  const [row] = await db
    .insert(meetingActionItems)
    .values({
      organizationId: params.organizationId,
      meetingId: params.meetingId,
      text: params.text,
      owner: params.owner ?? "—"
    })
    .returning();
  return row;
}

export async function setMeetingActionItemDone(params: {
  organizationId: string;
  itemId: string;
  done: boolean;
}): Promise<void> {
  const db = getDb();
  await db
    .update(meetingActionItems)
    .set({ done: params.done })
    .where(
      and(eq(meetingActionItems.id, params.itemId), eq(meetingActionItems.organizationId, params.organizationId))
    );
}

/* ── Agent runs ──────────────────────────────────────────────────────── */

export async function createAgentRun(params: {
  organizationId: string;
  userId: string;
  agentType: string;
  provider: string;
  model: string;
  prompt: string;
}): Promise<AgentRun> {
  const db = getDb();
  const [row] = await db
    .insert(agentRuns)
    .values({
      organizationId: params.organizationId,
      userId: params.userId,
      agentType: params.agentType,
      provider: params.provider,
      model: params.model,
      prompt: params.prompt.slice(0, 5000),
      status: "running"
    })
    .returning();
  return row;
}

export async function finishAgentRun(params: {
  id: string;
  organizationId: string;
  status: AgentRunStatus;
  resultExcerpt?: string;
  error?: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(agentRuns)
    .set({
      status: params.status,
      resultExcerpt: params.resultExcerpt?.slice(0, 2000),
      error: params.error?.slice(0, 1000),
      finishedAt: new Date()
    })
    .where(and(eq(agentRuns.id, params.id), eq(agentRuns.organizationId, params.organizationId)));
}

export async function listAgentRuns(organizationId: string, limit = 30): Promise<AgentRun[]> {
  const db = getDb();
  return db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.organizationId, organizationId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);
}

export async function getAgentRunStats(organizationId: string): Promise<{
  total: number;
  last7d: number;
  byAgent: { agentType: string; count: number }[];
}> {
  const db = getDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      last7d: sql<number>`count(*) filter (where ${agentRuns.createdAt} >= ${weekAgo})::int`
    })
    .from(agentRuns)
    .where(eq(agentRuns.organizationId, organizationId));

  const byAgent = await db
    .select({
      agentType: agentRuns.agentType,
      count: sql<number>`count(*)::int`
    })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), eq(agentRuns.status, "succeeded")))
    .groupBy(agentRuns.agentType)
    .orderBy(desc(sql`count(*)`));

  return {
    total: totals?.total ?? 0,
    last7d: totals?.last7d ?? 0,
    byAgent
  };
}

/* ── DevOps ──────────────────────────────────────────────────────────── */

export async function listDeployments(organizationId: string, limit = 20): Promise<Deployment[]> {
  const db = getDb();
  return db
    .select()
    .from(deployments)
    .where(eq(deployments.organizationId, organizationId))
    .orderBy(desc(deployments.createdAt))
    .limit(limit);
}

export async function createDeployment(params: {
  organizationId: string;
  service: string;
  version: string;
  status: DeploymentStatus;
  detail?: string;
  externalId?: string;
}): Promise<Deployment> {
  const db = getDb();
  const [row] = await db
    .insert(deployments)
    .values({
      organizationId: params.organizationId,
      service: params.service,
      version: params.version,
      status: params.status,
      detail: params.detail,
      externalId: params.externalId
    })
    .returning();
  return row;
}

export async function listIncidents(
  organizationId: string,
  opts?: { openOnly?: boolean; limit?: number }
): Promise<Incident[]> {
  const db = getDb();
  const limit = opts?.limit ?? 20;
  const statusFilter = opts?.openOnly
    ? inArray(incidents.status, ["open", "acknowledged"])
    : undefined;
  return db
    .select()
    .from(incidents)
    .where(and(eq(incidents.organizationId, organizationId), statusFilter))
    .orderBy(desc(incidents.createdAt))
    .limit(limit);
}

export async function createIncident(params: {
  organizationId: string;
  code: string;
  title: string;
  severity: IncidentSeverity;
  summary?: string;
  externalId?: string;
}): Promise<Incident> {
  const db = getDb();
  const [row] = await db
    .insert(incidents)
    .values({
      organizationId: params.organizationId,
      code: params.code,
      title: params.title,
      severity: params.severity,
      summary: params.summary,
      externalId: params.externalId,
      status: "open"
    })
    .returning();
  return row;
}

export async function acknowledgeIncident(organizationId: string, incidentId: string): Promise<Incident | undefined> {
  const db = getDb();
  const [row] = await db
    .update(incidents)
    .set({ status: "acknowledged" })
    .where(and(eq(incidents.id, incidentId), eq(incidents.organizationId, organizationId)))
    .returning();
  return row;
}

export async function resolveIncident(organizationId: string, incidentId: string): Promise<Incident | undefined> {
  const db = getDb();
  const [row] = await db
    .update(incidents)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(and(eq(incidents.id, incidentId), eq(incidents.organizationId, organizationId)))
    .returning();
  return row;
}

export async function countOpenIncidents(organizationId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incidents)
    .where(
      and(
        eq(incidents.organizationId, organizationId),
        inArray(incidents.status, ["open", "acknowledged"])
      )
    );
  return row?.count ?? 0;
}

export async function getDeploymentFrequency(
  organizationId: string,
  days = 14
): Promise<{ day: string; count: number }[]> {
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${deployments.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`
    })
    .from(deployments)
    .where(and(eq(deployments.organizationId, organizationId), gte(deployments.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${deployments.createdAt})`)
    .orderBy(sql`date_trunc('day', ${deployments.createdAt})`);
  return rows;
}

/* ── Dashboard aggregates ────────────────────────────────────────────── */

export async function getDashboardStats(organizationId: string, userId: string): Promise<{
  meetingsToday: number;
  openTasks: number;
  sprintProgress: number;
  openIncidents: number;
  agentRuns7d: number;
  unreadNotifications: number;
}> {
  const db = getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [meetingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(meetings)
    .where(
      and(
        eq(meetings.organizationId, organizationId),
        gte(meetings.startsAt, start),
        sql`${meetings.startsAt} <= ${end}`
      )
    );

  const [taskCounts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${projectTasks.status} <> 'Done')::int`,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${projectTasks.status} = 'Done')::int`
    })
    .from(projectTasks)
    .where(eq(projectTasks.organizationId, organizationId));

  const openIncidents = await countOpenIncidents(organizationId);
  const unreadNotifications = await countUnreadNotifications(organizationId, userId);

  const [runCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), gte(agentRuns.createdAt, weekAgo)));

  const total = taskCounts?.total ?? 0;
  const done = taskCounts?.done ?? 0;
  const sprintProgress = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    meetingsToday: meetingCount?.count ?? 0,
    openTasks: taskCounts?.open ?? 0,
    sprintProgress,
    openIncidents,
    agentRuns7d: runCount?.count ?? 0,
    unreadNotifications
  };
}
