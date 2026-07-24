import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { organizationApiKeys, type OrganizationApiKey } from "@/lib/db/schema";

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function generateApiKeySecret(): { plaintext: string; prefix: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  const plaintext = `nx_live_${token}`;
  const prefix = plaintext.slice(0, 16);
  return { plaintext, prefix, hash: hashApiKey(plaintext) };
}

export async function listOrgApiKeys(organizationId: string): Promise<OrganizationApiKey[]> {
  const db = getDb();
  return db
    .select()
    .from(organizationApiKeys)
    .where(eq(organizationApiKeys.organizationId, organizationId))
    .orderBy(desc(organizationApiKeys.createdAt));
}

export async function createOrgApiKey(params: {
  organizationId: string;
  name: string;
  createdByUserId: string;
}): Promise<{ key: OrganizationApiKey; plaintext: string }> {
  const { plaintext, prefix, hash } = generateApiKeySecret();
  const db = getDb();
  const [key] = await db
    .insert(organizationApiKeys)
    .values({
      organizationId: params.organizationId,
      name: params.name.slice(0, 80),
      keyPrefix: prefix,
      keyHash: hash,
      createdByUserId: params.createdByUserId
    })
    .returning();
  return { key, plaintext };
}

export async function revokeOrgApiKey(params: {
  organizationId: string;
  keyId: string;
}): Promise<OrganizationApiKey | undefined> {
  const db = getDb();
  const [row] = await db
    .update(organizationApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(organizationApiKeys.id, params.keyId),
        eq(organizationApiKeys.organizationId, params.organizationId),
        isNull(organizationApiKeys.revokedAt)
      )
    )
    .returning();
  return row;
}

/** Resolve a live (non-revoked) org API key from a Bearer token. */
export async function resolveOrgApiKey(
  plaintext: string
): Promise<{ organizationId: string; keyId: string } | undefined> {
  if (!plaintext.startsWith("nx_live_")) return undefined;
  const hash = hashApiKey(plaintext);
  const db = getDb();
  const [row] = await db
    .select()
    .from(organizationApiKeys)
    .where(and(eq(organizationApiKeys.keyHash, hash), isNull(organizationApiKeys.revokedAt)))
    .limit(1);
  if (!row) return undefined;

  await db
    .update(organizationApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(organizationApiKeys.id, row.id));

  return { organizationId: row.organizationId, keyId: row.id };
}
