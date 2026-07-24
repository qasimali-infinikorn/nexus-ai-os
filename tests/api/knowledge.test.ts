import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { documentChunks, documents, organizations, organizationApiKeys, users, EMBEDDING_DIMENSIONS } from "@/lib/db/schema";
import { resetRateLimiterForTests } from "@/lib/rate-limit";
import { createTestDb } from "../helpers/testDb";

const ORG_A = "00000000-0000-4000-8000-0000000000a1";
const ORG_B = "00000000-0000-4000-8000-0000000000b2";

// /api/knowledge now requires an authenticated session (see
// app/api/knowledge/route.ts) — mock it so these tests keep exercising the
// document/search logic without standing up a real auth flow. See
// tests/api/orchestrate.test.ts for why vi.hoisted() is required here.
const { mockAuth, mockGetOrgProviderKey } = vi.hoisted(() => ({
  mockAuth: vi.fn(async () => ({
    user: { id: "test-user", email: "test@example.com", name: "Test User", isPlatformAdmin: false },
    organizationId: "00000000-0000-4000-8000-0000000000a1",
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

function getRequest(headers?: HeadersInit) {
  return new NextRequest("http://localhost/api/knowledge", {
    method: "GET",
    headers
  });
}

function postRequest(body: unknown, headers?: HeadersInit) {
  return new NextRequest("http://localhost/api/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
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

async function seedOrgs() {
  await testDb.insert(organizations).values([
    { id: ORG_A, name: "Org A", slug: "org-a" },
    { id: ORG_B, name: "Org B", slug: "org-b" }
  ]);
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
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({
    user: { id: "test-user", email: "test@example.com", name: "Test User", isPlatformAdmin: false },
    organizationId: ORG_A,
    organizationName: "Org A",
    role: "owner" as const
  });
  mockGetOrgProviderKey.mockReset();
  mockGetOrgProviderKey.mockResolvedValue(undefined);
  await testDb.delete(documentChunks);
  await testDb.delete(documents);
  await testDb.delete(organizationApiKeys);
  await testDb.delete(users);
  await testDb.delete(organizations);
  await seedOrgs();
});

afterEach(() => {
  __setDbForTests(null);
  vi.unstubAllGlobals();
});

describe("authentication", () => {
  it("rejects an unauthenticated GET", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated POST", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(postRequest({ action: "search", query: "x" }));
    expect(res.status).toBe(401);
  });

  it("accepts a valid org API key Bearer token without a session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const { createOrgApiKey } = await import("@/lib/db/api-keys");
    const { users } = await import("@/lib/db/schema");
    const userId = "00000000-0000-4000-8000-000000000099";
    await testDb.insert(users).values({
      id: userId,
      email: "api@example.com",
      name: "API",
      passwordHash: "h"
    });
    const { plaintext } = await createOrgApiKey({
      organizationId: ORG_A,
      name: "CI",
      createdByUserId: userId
    });

    const res = await GET(getRequest({ Authorization: `Bearer ${plaintext}` }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

describe("GET /api/knowledge", () => {
  it("returns an empty file list when no documents exist", async () => {
    const res = await GET(getRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.files).toEqual([]);
  });

  it("lists only documents for the active organization", async () => {
    await testDb.insert(documents).values([
      { organizationId: ORG_A, name: "standards.md", content: "# Standards" },
      { organizationId: ORG_B, name: "secret.md", content: "# Other tenant" }
    ]);

    const res = await GET(getRequest());
    const data = await res.json();

    expect(data.files).toHaveLength(1);
    expect(data.files[0].name).toBe("standards.md");
    expect(data.files[0].sizeBytes).toBe(Buffer.byteLength("# Standards", "utf8"));
  });
});

describe("POST /api/knowledge - add", () => {
  it("creates a document with a trimmed name scoped to the org", async () => {
    const res = await POST(postRequest({ action: "add", name: "  notes.md  ", content: "hi" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const rows = await testDb.select().from(documents);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("notes.md");
    expect(rows[0].organizationId).toBe(ORG_A);
  });

  it("allows the same filename in two different organizations", async () => {
    await POST(postRequest({ action: "add", name: "shared.md", content: "org-a copy" }));

    mockAuth.mockResolvedValue({
      user: { id: "user-b", email: "b@example.com", name: "B", isPlatformAdmin: false },
      organizationId: ORG_B,
      organizationName: "Org B",
      role: "owner" as const
    });
    await POST(postRequest({ action: "add", name: "shared.md", content: "org-b copy" }));

    const rows = await testDb.select().from(documents).orderBy(documents.organizationId);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.content).sort()).toEqual(["org-a copy", "org-b copy"]);
  });

  it("replaces content and chunks when the same name is added again", async () => {
    await POST(postRequest({ action: "add", name: "doc.md", content: "original content" }));
    const res = await POST(postRequest({ action: "add", name: "doc.md", content: "updated content" }));
    expect(res.status).toBe(200);

    const rows = await testDb.select().from(documents).where(eq(documents.organizationId, ORG_A));
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

  it("does not delete another organization's document of the same name", async () => {
    await testDb.insert(documents).values({
      organizationId: ORG_B,
      name: "doc.md",
      content: "tenant B secret"
    });

    const res = await POST(postRequest({ action: "delete", name: "doc.md" }));
    expect(res.status).toBe(404);

    const remaining = await testDb.select().from(documents);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].organizationId).toBe(ORG_B);
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

  it("does not return another organization's documents", async () => {
    await testDb.insert(documents).values({
      organizationId: ORG_B,
      name: "leak.md",
      content: "testing secret from other tenant"
    });
    await POST(postRequest({ action: "add", name: "mine.md", content: "testing once" }));

    const res = await POST(postRequest({ action: "search", query: "testing" }));
    const data = await res.json();

    expect(data.matches.map((m: { filename: string }) => m.filename)).toEqual(["mine.md"]);
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

    const getRes = await GET(getRequest());
    expect(getRes.status).toBe(200);
  });
});
