import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { documents, embedJobs, organizations } from "@/lib/db/schema";
import { enqueueEmbedJob, processEmbedJobs } from "@/lib/db/embed-jobs";
import { createTestDb } from "../helpers/testDb";

const ORG = "00000000-0000-4000-8000-0000000000a1";

const { mockGetOrgProviderKey } = vi.hoisted(() => ({
  mockGetOrgProviderKey: vi.fn(async () => "sk-test")
}));
vi.mock("@/lib/db/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/queries")>();
  return {
    ...actual,
    getOrgProviderKey: () => mockGetOrgProviderKey()
  };
});
vi.mock("@/lib/embeddings", () => ({
  getEmbeddings: vi.fn(async (_p: string, _k: string, texts: string[]) =>
    texts.map(() => new Array(1536).fill(0.01))
  )
}));

let testDb: Database;

beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  __setDbForTests(testDb);
  mockGetOrgProviderKey.mockResolvedValue("sk-test");
  await testDb.delete(embedJobs);
  await testDb.delete(documents);
  await testDb.delete(organizations);
  await testDb.insert(organizations).values({ id: ORG, name: "Org", slug: "org" });
});

afterEach(() => {
  __setDbForTests(null);
});

describe("embed jobs", () => {
  it("enqueues and processes a pending job", async () => {
    const [doc] = await testDb
      .insert(documents)
      .values({ organizationId: ORG, name: "big.md", content: "Hello world chunk content." })
      .returning();

    const job = await enqueueEmbedJob({ organizationId: ORG, documentId: doc.id });
    expect(job.status).toBe("pending");

    const result = await processEmbedJobs(5);
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });

    const [done] = await testDb.select().from(embedJobs).where(eq(embedJobs.id, job.id));
    expect(done.status).toBe("succeeded");
  });

  it("fails when OpenAI key is missing", async () => {
    mockGetOrgProviderKey.mockResolvedValueOnce(undefined as never);
    const [doc] = await testDb
      .insert(documents)
      .values({ organizationId: ORG, name: "x.md", content: "content" })
      .returning();
    await enqueueEmbedJob({ organizationId: ORG, documentId: doc.id });
    const result = await processEmbedJobs(1);
    expect(result.failed).toBe(1);
  });
});
