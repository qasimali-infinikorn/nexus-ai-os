import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  platformIncidents,
  type PlatformIncident,
  type PlatformIncidentSeverity
} from "@/lib/db/schema";

export async function countOpenPlatformIncidents(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformIncidents)
    .where(eq(platformIncidents.status, "open"));
  return row?.count ?? 0;
}

export async function listPlatformIncidents(limit = 50): Promise<PlatformIncident[]> {
  const db = getDb();
  return db
    .select()
    .from(platformIncidents)
    .orderBy(desc(platformIncidents.createdAt))
    .limit(limit);
}

export async function listOpenPlatformIncidents(): Promise<PlatformIncident[]> {
  const db = getDb();
  return db
    .select()
    .from(platformIncidents)
    .where(eq(platformIncidents.status, "open"))
    .orderBy(desc(platformIncidents.createdAt));
}

export async function createPlatformIncident(params: {
  title: string;
  summary?: string;
  severity: PlatformIncidentSeverity;
  createdByUserId: string;
}): Promise<PlatformIncident> {
  const db = getDb();
  const [row] = await db
    .insert(platformIncidents)
    .values({
      title: params.title,
      summary: params.summary,
      severity: params.severity,
      status: "open",
      createdByUserId: params.createdByUserId
    })
    .returning();
  return row;
}

export async function resolvePlatformIncident(params: {
  id: string;
  resolvedByUserId: string;
}): Promise<PlatformIncident | undefined> {
  const db = getDb();
  const [row] = await db
    .update(platformIncidents)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      resolvedByUserId: params.resolvedByUserId
    })
    .where(and(eq(platformIncidents.id, params.id), eq(platformIncidents.status, "open")))
    .returning();
  return row;
}
