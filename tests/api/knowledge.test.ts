import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { documentChunks, documents, EMBEDDING_DIMENSIONS } from "@/lib/db/schema";
import { resetRateLimiterForTests } from "@/lib/rate-limit";
import { createTestDb } from "../helpers/testDb";

// /api/knowledge now requires an authenticated session (see
// app/api/knowledge/route.ts) — mock it so these tests keep exercising the
// document/search logic without standing up a real auth flow. See
// tests/api/orchestrate.test.ts for why vi.hoisted() is required here.
const { mockAuth, mockGetOrgProviderKey } = vi.hoisted(() => ({
  mockAuth: vi.fn(async () => ({
    user: { id: "test-user", email: "test@example.com", name: "Test User", isPlatformAdmin: false },
    organizationId: "test-org",
    organizationName: "Test Org",
    role: "owner" as const
  })),
  mockGetOrgProviderKey: vi.fn<(organizationId: string, provider: string) => Promise<string | undefined>>(
    async () => undefined
  )
}));
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db/queries", () => ({
  getOrgProviderKey: (organizationId: string, provider: string) =>
    mockGetOrgProviderKey(organizationId, provider)
}));

const { GET, POST } = await import("@/app/api/knowledge/route");

let testDb: Database;

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function oneHot(index: number, dims = EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array(dims).fill(0);
  vector[index] = 1;
  return vector;
}

function embeddingsResponse(vectors: number[][]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: vectors.map((embedding, index) => ({ embedding, index })) }),
    text: async () => ""
  } as Response;
}

// PGlite boots a real WASM Postgres and runs the full migration set, which
// costs ~1.5s — do that once per file, then just clear tables between
// tests, rather than paying that cost for every single test.
beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  resetRateLimiterForTests();
  __setDbForTests(testDb);
  mockAuth.mockClear();
  mockGetOrgProviderKey.mockReset();
  mockGetOrgProviderKey.mockResolvedValue(undefined);
  await testDb.delete(documentChunks);
  await testDb.delete(documents);
});

afterEach(() => {
  __setDbForTests(null);
  vi.unstubAllGlobals();
});

describe("authentication", () => {
  it("rejects an unauthenticated GET", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated POST", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(postRequest({ action: "search", query: "x" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/knowledge", () => {
  it("returns an empty file list when no documents exist", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.files).toEqual([]);
  });

  it("lists documents that exist in the database", async () => {
    await testDb.insert(documents).values({ name: "standards.md", content: "# Standards" });

    const res = await GET();
    const data = await res.json();

    expect(data.files).toHaveLength(1);
    expect(data.files[0].name).toBe("standards.md");
    expect(data.files[0].sizeBytes).toBe(Buffer.byteLength("# Standards", "utf8"));
  });
});

describe("POST /api/knowledge - add", () => {
  it("creates a document with a trimmed name", async () => {
    const res = await POST(postRequest({ action: "add", name: "  notes.md  ", content: "hi" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const rows = await testDb.select().from(documents);
    expect(rows.map((r) => r.name)).toEqual(["notes.md"]);
  });

  it("replaces content and chunks when the same name is added again", async () => {
    await POST(postRequest({ action: "add", name: "doc.md", content: "original content" }));
    const res = await POST(postRequest({ action: "add", name: "doc.md", content: "updated content" }));
    expect(res.status).toBe(200);

    const rows = await testDb.select().from(documents);
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("updated content");

    const chunks = await testDb.select().from(documentChunks).where(eq(documentChunks.documentId, rows[0].id));
    expect(chunks.map((c) => c.content)).toEqual(["updated content"]);
  });

  it("rejects an empty or whitespace-only name", async () => {
    for (const name of ["", "   "]) {
      const res = await POST(postRequest({ action: "add", name, content: "hi" }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects content larger than the configured byte cap", async () => {
    const { MAX_KNOWLEDGE_CONTENT_BYTES } = await import("@/lib/validation");
    const oversized = "a".repeat(MAX_KNOWLEDGE_CONTENT_BYTES + 1);

    const res = await POST(postRequest({ action: "add", name: "big.md", content: oversized }));
    expect(res.status).toBe(400);
  });

  it("computes and stores an embedding per chunk when the org has an OpenAI key", async () => {
    mockGetOrgProviderKey.mockResolvedValue("sk-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(embeddingsResponse([oneHot(0)])));

    const res = await POST(postRequest({ action: "add", name: "doc.md", content: "short content" }));
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);

    const chunks = await testDb.select().from(documentChunks);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].embedding).not.toBeNull();
  });

  it("stores chunks without embeddings when the org has no OpenAI key", async () => {
    vi.stubGlobal("fetch", vi.fn());

    await POST(postRequest({ action: "add", name: "doc.md", content: "short content" }));

    expect(fetch).not.toHaveBeenCalled();
    const chunks = await testDb.select().from(documentChunks);
    expect(chunks[0].embedding).toBeNull();
  });
});

describe("POST /api/knowledge - delete", () => {
  it("deletes a document and cascades to its chunks", async () => {
    await POST(postRequest({ action: "add", name: "doc.md", content: "some content" }));
    expect(await testDb.select().from(documentChunks)).not.toHaveLength(0);

    const res = await POST(postRequest({ action: "delete", name: "doc.md" }));
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(await testDb.select().from(documents)).toHaveLength(0);
    expect(await testDb.select().from(documentChunks)).toHaveLength(0);
  });

  it("returns 404 for a document that does not exist", async () => {
    const res = await POST(postRequest({ action: "delete", name: "missing.md" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/knowledge - search (keyword fallback)", () => {
  it("ranks documents by literal term-occurrence count", async () => {
    await POST(postRequest({ action: "add", name: "a.md", content: "testing testing testing" }));
    await POST(postRequest({ action: "add", name: "b.md", content: "testing once" }));

    const res = await POST(postRequest({ action: "search", query: "testing" }));
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.matches[0].filename).toBe("a.md");
    expect(data.matches[0].relevance).toBeGreaterThan(data.matches[1].relevance);
  });

  it("does not throw on a query containing regex metacharacters", async () => {
    await POST(postRequest({ action: "add", name: "a.md", content: "some (content) here" }));

    const res = await POST(postRequest({ action: "search", query: "(a+)+$ [unbalanced" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("rejects an overlong query", async () => {
    const { MAX_KNOWLEDGE_QUERY_LENGTH } = await import("@/lib/validation");
    const res = await POST(postRequest({ action: "search", query: "q".repeat(MAX_KNOWLEDGE_QUERY_LENGTH + 1) }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/knowledge - search (pgvector semantic search)", () => {
  it("ranks the chunk closest to the query embedding first", async () => {
    mockGetOrgProviderKey.mockResolvedValue("sk-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(embeddingsResponse([oneHot(0)])) // doc-a embedding
      .mockResolvedValueOnce(embeddingsResponse([oneHot(1)])) // doc-b embedding
      .mockResolvedValueOnce(embeddingsResponse([oneHot(0)])); // query embedding (matches doc-a)
    vi.stubGlobal("fetch", fetchMock);

    await POST(postRequest({ action: "add", name: "doc-a.md", content: "alpha content" }));
    await POST(postRequest({ action: "add", name: "doc-b.md", content: "beta content" }));

    const res = await POST(
      postRequest({ action: "search", query: "anything", mode: "semantic" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mode).toBe("semantic");
    expect(data.matches[0].filename).toBe("doc-a.md");
    expect(data.matches[0].relevance).toBeGreaterThan(data.matches[1].relevance);
  });

  it("rejects semantic search when the org has no OpenAI key", async () => {
    const res = await POST(postRequest({ action: "search", query: "x", mode: "semantic" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/OpenAI/i);
  });
});

describe("rate limiting", () => {
  it("returns 429 once the write rate limit is exceeded", async () => {
    let lastStatus = 200;
    for (let i = 0; i < 40; i++) {
      const res = await POST(postRequest({ action: "add", name: `file-${i}.md`, content: "x" }));
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it("tracks GET (read) and POST (write) budgets independently", async () => {
    let lastWriteStatus = 200;
    for (let i = 0; i < 40; i++) {
      const res = await POST(postRequest({ action: "add", name: `f-${i}.md`, content: "x" }));
      lastWriteStatus = res.status;
      if (lastWriteStatus === 429) break;
    }
    expect(lastWriteStatus).toBe(429);

    const getRes = await GET();
    expect(getRes.status).toBe(200);
  });
});
