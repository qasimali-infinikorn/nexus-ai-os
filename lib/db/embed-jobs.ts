import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { documentChunks, documents, embedJobs, type EmbedJob } from "@/lib/db/schema";
import { chunkText } from "@/lib/chunk";
import { getEmbeddings } from "@/lib/embeddings";
import { getOrgProviderKey } from "@/lib/db/queries";

/** Docs above this size (or chunk count) enqueue instead of embedding inline. */
export const EMBED_INLINE_MAX_BYTES = 200_000;
export const EMBED_INLINE_MAX_CHUNKS = 40;

export async function enqueueEmbedJob(params: {
  organizationId: string;
  documentId: string;
}): Promise<EmbedJob> {
  const db = getDb();
  await db
    .update(embedJobs)
    .set({ status: "failed", error: "Superseded by newer upload", finishedAt: new Date() })
    .where(and(eq(embedJobs.documentId, params.documentId), eq(embedJobs.status, "pending")));

  const [job] = await db
    .insert(embedJobs)
    .values({
      organizationId: params.organizationId,
      documentId: params.documentId,
      status: "pending"
    })
    .returning();
  return job;
}

/**
 * Claim and process up to `limit` pending embed jobs.
 * Intended for cron / internal route — not end-user facing.
 */
export async function processEmbedJobs(limit = 5): Promise<{ processed: number; succeeded: number; failed: number }> {
  const db = getDb();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  const pending = await db
    .select()
    .from(embedJobs)
    .where(eq(embedJobs.status, "pending"))
    .orderBy(asc(embedJobs.createdAt))
    .limit(limit);

  for (const job of pending) {
    const [claimed] = await db
      .update(embedJobs)
      .set({
        status: "processing",
        startedAt: new Date(),
        attempts: job.attempts + 1
      })
      .where(and(eq(embedJobs.id, job.id), eq(embedJobs.status, "pending")))
      .returning();
    if (!claimed) continue;

    processed += 1;
    try {
      await runEmbedJob(claimed.id);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Embed failed";
      await db
        .update(embedJobs)
        .set({ status: "failed", error: message.slice(0, 1000), finishedAt: new Date() })
        .where(eq(embedJobs.id, claimed.id));
    }
  }

  return { processed, succeeded, failed };
}

async function runEmbedJob(jobId: string): Promise<void> {
  const db = getDb();
  const [job] = await db.select().from(embedJobs).where(eq(embedJobs.id, jobId)).limit(1);
  if (!job) throw new Error("Job not found");

  const [doc] = await db.select().from(documents).where(eq(documents.id, job.documentId)).limit(1);
  if (!doc) throw new Error("Document not found");

  const openaiKey = await getOrgProviderKey(job.organizationId, "openai");
  if (!openaiKey) throw new Error("Organization has no OpenAI key for embeddings");

  const chunks = chunkText(doc.content);
  await db.delete(documentChunks).where(eq(documentChunks.documentId, doc.id));

  if (chunks.length === 0) {
    await db
      .update(embedJobs)
      .set({ status: "succeeded", finishedAt: new Date(), error: null })
      .where(eq(embedJobs.id, jobId));
    return;
  }

  const embeddings = await getEmbeddings("openai", openaiKey, chunks);
  await db.insert(documentChunks).values(
    chunks.map((content, index) => ({
      documentId: doc.id,
      chunkIndex: index,
      content,
      embedding: embeddings[index] ?? null
    }))
  );

  await db
    .update(embedJobs)
    .set({ status: "succeeded", finishedAt: new Date(), error: null })
    .where(eq(embedJobs.id, jobId));
}

export async function listPendingEmbedJobs(organizationId: string): Promise<EmbedJob[]> {
  const db = getDb();
  return db
    .select()
    .from(embedJobs)
    .where(and(eq(embedJobs.organizationId, organizationId), eq(embedJobs.status, "pending")))
    .orderBy(asc(embedJobs.createdAt));
}
