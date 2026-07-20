import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

// KNOWLEDGE_DIR is computed from process.cwd() at module load time, so
// process.cwd() must be mocked *before* the route module is imported. Each
// test resets the module registry and re-imports so it picks up the fresh
// tmp dir.
let tmpDir: string;

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/knowledge/route");
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function getRequest() {
  return new NextRequest("http://localhost/api/knowledge");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-knowledge-"));
  vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/knowledge", () => {
  it("returns an empty file list when the directory has just been created", async () => {
    const { GET } = await loadRoute();
    const res = await GET(getRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.files).toEqual([]);
  });

  it("lists files that were written directly to disk", async () => {
    const { GET } = await loadRoute();
    fs.mkdirSync(path.join(tmpDir, "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "knowledge", "standards.md"), "# Standards");

    const res = await GET(getRequest());
    const data = await res.json();

    expect(data.files).toHaveLength(1);
    expect(data.files[0].name).toBe("standards.md");
  });
});

describe("POST /api/knowledge - add", () => {
  it("creates a file with a sanitized name", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postRequest({ action: "add", name: "../../evil.md", content: "hi" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // Should land inside the knowledge dir under a sanitized basename, never
    // escaping it.
    const written = fs.readdirSync(path.join(tmpDir, "knowledge"));
    expect(written).toEqual(["evil.md"]);
  });

  it("rejects a name of '.' or '..' outright", async () => {
    const { POST } = await loadRoute();
    for (const name of [".", ".."]) {
      const res = await POST(postRequest({ action: "add", name, content: "hi" }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects content larger than the configured byte cap", async () => {
    const { POST } = await loadRoute();
    const { MAX_KNOWLEDGE_CONTENT_BYTES } = await import("@/lib/validation");
    const oversized = "a".repeat(MAX_KNOWLEDGE_CONTENT_BYTES + 1);

    const res = await POST(postRequest({ action: "add", name: "big.md", content: oversized }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/knowledge - delete", () => {
  it("deletes an existing file", async () => {
    const { POST } = await loadRoute();
    fs.mkdirSync(path.join(tmpDir, "knowledge"), { recursive: true });
    const target = path.join(tmpDir, "knowledge", "delete-me.md");
    fs.writeFileSync(target, "bye");

    const res = await POST(postRequest({ action: "delete", name: "delete-me.md" }));
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("returns 404 for a file that does not exist", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postRequest({ action: "delete", name: "missing.md" }));
    expect(res.status).toBe(404);
  });

  it("cannot be used to delete the knowledge directory itself via '..'", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postRequest({ action: "delete", name: ".." }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/knowledge - search", () => {
  it("ranks files by literal term-occurrence count", async () => {
    const { POST } = await loadRoute();
    fs.mkdirSync(path.join(tmpDir, "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "knowledge", "a.md"), "testing testing testing");
    fs.writeFileSync(path.join(tmpDir, "knowledge", "b.md"), "testing once");

    const res = await POST(postRequest({ action: "search", query: "testing" }));
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.matches[0].filename).toBe("a.md");
    expect(data.matches[0].relevance).toBeGreaterThan(data.matches[1].relevance);
  });

  it("does not throw on a query containing regex metacharacters", async () => {
    const { POST } = await loadRoute();
    fs.mkdirSync(path.join(tmpDir, "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "knowledge", "a.md"), "some (content) here");

    const res = await POST(postRequest({ action: "search", query: "(a+)+$ [unbalanced" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("rejects an overlong query", async () => {
    const { POST } = await loadRoute();
    const { MAX_KNOWLEDGE_QUERY_LENGTH } = await import("@/lib/validation");
    const res = await POST(postRequest({ action: "search", query: "q".repeat(MAX_KNOWLEDGE_QUERY_LENGTH + 1) }));
    expect(res.status).toBe(400);
  });
});

describe("rate limiting", () => {
  it("returns 429 once the write rate limit is exceeded", async () => {
    const { POST } = await loadRoute();

    let lastStatus = 200;
    for (let i = 0; i < 40; i++) {
      const res = await POST(postRequest({ action: "add", name: `file-${i}.md`, content: "x" }));
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }

    expect(lastStatus).toBe(429);
  });

  it("tracks GET (read) and POST (write) budgets independently", async () => {
    const { GET, POST } = await loadRoute();

    // Exhaust the write budget only.
    let lastWriteStatus = 200;
    for (let i = 0; i < 40; i++) {
      const res = await POST(postRequest({ action: "add", name: `f-${i}.md`, content: "x" }));
      lastWriteStatus = res.status;
      if (lastWriteStatus === 429) break;
    }
    expect(lastWriteStatus).toBe(429);

    // GET should be unaffected by the exhausted write budget.
    const getRes = await GET(getRequest());
    expect(getRes.status).toBe(200);
  });
});
