import { NextRequest, NextResponse } from "next/server";
import { and, cosineDistance, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { documentChunks, documents } from "@/lib/db/schema";
import { chunkText } from "@/lib/chunk";
import { getEmbeddings } from "@/lib/embeddings";
import { getOrgProviderKey } from "@/lib/db/queries";
import { authRateLimitKey, resolveRequestAuth } from "@/lib/auth/request-auth";
import { rateLimit } from "@/lib/rate-limit";
import { EMBED_INLINE_MAX_BYTES, EMBED_INLINE_MAX_CHUNKS } from "@/lib/db/embed-jobs";
import {
  MAX_KNOWLEDGE_CONTENT_BYTES,
  MAX_KNOWLEDGE_NAME_LENGTH,
  MAX_KNOWLEDGE_QUERY_LENGTH,
  isNonEmptyString
} from "@/lib/validation";

const READ_RATE_LIMIT = 60;
const WRITE_RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Internal server error.";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkRateLimit(bucketKey: string, bucket: "read" | "write", limit: number): NextResponse | null {
  const { allowed, retryAfterMs } = rateLimit(`knowledge:${bucket}:${bucketKey}`, limit, RATE_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    );
  }
  return null;
}

/** Resolve OpenAI key for embeddings — org BYOK only (never trust client-supplied keys). */
async function resolveOpenAiKey(organizationId: string): Promise<string | undefined> {
  return getOrgProviderKey(organizationId, "openai");
}

// GET: List org documents + whether semantic search is available
export async function GET(req: NextRequest) {
  const authCtx = await resolveRequestAuth(req);
  if (!authCtx) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  const limited = checkRateLimit(authRateLimitKey(authCtx), "read", READ_RATE_LIMIT);
  if (limited) return limited;

  try {
    const db = getDb();
    const [rows, openaiKey] = await Promise.all([
      db
        .select()
        .from(documents)
        .where(eq(documents.organizationId, authCtx.organizationId))
        .orderBy(documents.name),
      resolveOpenAiKey(authCtx.organizationId)
    ]);

    const fileList = rows.map((doc) => ({
      name: doc.name,
      sizeBytes: Buffer.byteLength(doc.content, "utf8"),
      updatedAt: new Date(doc.updatedAt).toISOString()
    }));

    return NextResponse.json({
      success: true,
      files: fileList,
      semanticAvailable: Boolean(openaiKey)
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

// POST: Handles add file, delete file, and query search (all org-scoped)
export async function POST(req: NextRequest) {
  const authCtx = await resolveRequestAuth(req);
  if (!authCtx) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  const limited = checkRateLimit(authRateLimitKey(authCtx), "write", WRITE_RATE_LIMIT);
  if (limited) return limited;

  try {
    const body = await req.json();
    const { action } = body;
    const db = getDb();
    const orgId = authCtx.organizationId;

    if (action === "add") {
      const { name, content } = body;
      if (!isNonEmptyString(name) || typeof content !== "string") {
        return NextResponse.json({ success: false, error: "Invalid filename or content" }, { status: 400 });
      }

      const trimmedName = name.trim();
      if (trimmedName.length > MAX_KNOWLEDGE_NAME_LENGTH) {
        return NextResponse.json({ success: false, error: "Invalid filename" }, { status: 400 });
      }
      if (Buffer.byteLength(content, "utf8") > MAX_KNOWLEDGE_CONTENT_BYTES) {
        return NextResponse.json(
          { success: false, error: `Content exceeds the maximum size of ${MAX_KNOWLEDGE_CONTENT_BYTES} bytes.` },
          { status: 400 }
        );
      }

      const [doc] = await db
        .insert(documents)
        .values({ organizationId: orgId, name: trimmedName, content })
        .onConflictDoUpdate({
          target: [documents.organizationId, documents.name],
          set: { content, updatedAt: new Date() }
        })
        .returning();

      // Replace this document's chunks/embeddings from scratch on every add.
      await db.delete(documentChunks).where(eq(documentChunks.documentId, doc.id));

      const chunks = chunkText(content);
      let embedded = false;
      let queued = false;
      if (chunks.length > 0) {
        const wantEmbed = body.embed !== false;
        const openaiKey = wantEmbed ? await resolveOpenAiKey(orgId) : undefined;
        const contentBytes = Buffer.byteLength(content, "utf8");
        const shouldQueue =
          Boolean(openaiKey) &&
          (contentBytes > EMBED_INLINE_MAX_BYTES || chunks.length > EMBED_INLINE_MAX_CHUNKS);

        if (shouldQueue) {
          await db.insert(documentChunks).values(
            chunks.map((chunkContent, index) => ({
              documentId: doc.id,
              chunkIndex: index,
              content: chunkContent,
              embedding: null
            }))
          );
          const { enqueueEmbedJob } = await import("@/lib/db/embed-jobs");
          await enqueueEmbedJob({ organizationId: orgId, documentId: doc.id });
          queued = true;
        } else {
          const embeddings = openaiKey ? await getEmbeddings("openai", openaiKey, chunks) : [];
          embedded = embeddings.length > 0;

          await db.insert(documentChunks).values(
            chunks.map((chunkContent, index) => ({
              documentId: doc.id,
              chunkIndex: index,
              content: chunkContent,
              embedding: embeddings[index] ?? null
            }))
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: `File ${doc.name} created/updated successfully.`,
        embedded,
        queued
      });
    }

    if (action === "delete") {
      const { name } = body;
      if (!isNonEmptyString(name)) {
        return NextResponse.json({ success: false, error: "Filename is required" }, { status: 400 });
      }

      const deleted = await db
        .delete(documents)
        .where(and(eq(documents.organizationId, orgId), eq(documents.name, name.trim())))
        .returning();
      if (deleted.length === 0) {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: `File ${deleted[0].name} deleted.` });
    }

    if (action === "search") {
      const { query } = body;
      if (!query || typeof query !== "string") {
        return NextResponse.json({ success: true, context: "", matches: [], mode: "keyword" });
      }
      if (query.length > MAX_KNOWLEDGE_QUERY_LENGTH) {
        return NextResponse.json(
          { success: false, error: `query exceeds the maximum length of ${MAX_KNOWLEDGE_QUERY_LENGTH} characters.` },
          { status: 400 }
        );
      }

      const mode = body.mode === "semantic" ? "semantic" : "keyword";

      if (mode === "semantic") {
        const openaiKey = await resolveOpenAiKey(orgId);
        if (!openaiKey) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Semantic search needs an OpenAI key. Add one under Settings → Integrations, then re-save documents to generate embeddings."
            },
            { status: 400 }
          );
        }

        const [queryEmbedding] = await getEmbeddings("openai", openaiKey, [query]);
        const distance = cosineDistance(documentChunks.embedding, queryEmbedding);

        const rows = await db
          .select({ filename: documents.name, content: documentChunks.content, distance })
          .from(documentChunks)
          .innerJoin(documents, eq(documentChunks.documentId, documents.id))
          .where(and(eq(documents.organizationId, orgId), isNotNull(documentChunks.embedding)))
          .orderBy(distance)
          .limit(10);

        if (rows.length === 0) {
          return NextResponse.json({
            success: true,
            mode: "semantic",
            context: "",
            matches: [],
            message:
              "No embedded chunks found. Re-save documents after configuring an OpenAI key to index them for semantic search."
          });
        }

        const matches = rows.map((row) => ({
          filename: row.filename,
          relevance: 1 - Number(row.distance),
          snippet: row.content.slice(0, 300) + (row.content.length > 300 ? "..." : "")
        }));

        const combinedContext = rows.map((row) => `--- DOCUMENT: ${row.filename} ---\n${row.content}`).join("\n\n");

        return NextResponse.json({
          success: true,
          mode: "semantic",
          context: combinedContext.trim(),
          matches
        });
      }

      // Keyword-search fallback over this org's document content.
      const rows = await db.select().from(documents).where(eq(documents.organizationId, orgId));
      const matches: { filename: string; relevance: number; snippet: string }[] = [];
      let combinedContext = "";

      const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

      for (const doc of rows) {
        let relevanceScore = 0;
        if (queryTerms.length > 0) {
          const lowerContent = doc.content.toLowerCase();
          queryTerms.forEach((term) => {
            const matchesCount = (lowerContent.match(new RegExp(escapeRegExp(term), "g")) || []).length;
            relevanceScore += matchesCount;
          });
        }

        if (relevanceScore === 0 && doc.content.length > 10) {
          relevanceScore = 0.1;
        }

        if (relevanceScore > 0) {
          const snippet = doc.content.slice(0, 300) + (doc.content.length > 300 ? "..." : "");
          matches.push({ filename: doc.name, relevance: relevanceScore, snippet });
          combinedContext += `--- DOCUMENT: ${doc.name} ---\n${doc.content}\n\n`;
        }
      }

      matches.sort((a, b) => b.relevance - a.relevance);

      return NextResponse.json({
        success: true,
        mode: "keyword",
        context: combinedContext.trim(),
        matches
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
