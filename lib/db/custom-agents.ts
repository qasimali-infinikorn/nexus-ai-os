import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orgCustomAgents, type OrgCustomAgent } from "@/lib/db/schema";
import { slugify } from "@/lib/db/queries";

export async function listOrgCustomAgents(organizationId: string): Promise<OrgCustomAgent[]> {
  const db = getDb();
  return db
    .select()
    .from(orgCustomAgents)
    .where(eq(orgCustomAgents.organizationId, organizationId))
    .orderBy(asc(orgCustomAgents.name));
}

export async function getOrgCustomAgent(
  organizationId: string,
  key: string
): Promise<OrgCustomAgent | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(orgCustomAgents)
    .where(and(eq(orgCustomAgents.organizationId, organizationId), eq(orgCustomAgents.key, key)))
    .limit(1);
  return row;
}

export async function createOrgCustomAgent(params: {
  organizationId: string;
  createdByUserId: string;
  name: string;
  description: string;
  systemPrompt: string;
  accent?: string;
}): Promise<OrgCustomAgent> {
  const db = getDb();
  const base = slugify(params.name).replace(/-/g, "_").slice(0, 40) || "custom_agent";
  let key = `custom_${base}`;
  let n = 1;
  while (n < 20) {
    const existing = await getOrgCustomAgent(params.organizationId, key);
    if (!existing) break;
    n += 1;
    key = `custom_${base}_${n}`;
  }

  const [row] = await db
    .insert(orgCustomAgents)
    .values({
      organizationId: params.organizationId,
      key,
      name: params.name,
      description: params.description,
      systemPrompt: params.systemPrompt,
      accent: params.accent ?? "blue",
      createdByUserId: params.createdByUserId
    })
    .returning();
  return row;
}

export async function deleteOrgCustomAgent(organizationId: string, id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(orgCustomAgents)
    .where(and(eq(orgCustomAgents.id, id), eq(orgCustomAgents.organizationId, organizationId)));
}
