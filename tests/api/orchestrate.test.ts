import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimiterForTests } from "@/lib/rate-limit";
import { readNdjson } from "../helpers/stream";

// /api/orchestrate now resolves both the session and the provider key from
// the database (org-level BYOK — see docs/AUTH.md) rather than trusting a
// client-supplied `keys` object. Mock both at the module boundary so these
// tests stay focused on request validation/streaming behavior without
// standing up a real Postgres connection. vi.hoisted() is required here:
// vi.mock() factories run before this file's own top-level statements, so a
// plain `const` referenced inside one would hit the temporal dead zone.
const { mockAuth, mockGetOrgProviderKey, mockResolveOrgApiKey } = vi.hoisted(() => ({
  mockAuth: vi.fn(async () => ({
    user: { id: "test-user", email: "test@example.com", name: "Test User", isPlatformAdmin: false },
    organizationId: "test-org",
    organizationName: "Test Org",
    role: "owner" as const
  })),
  mockGetOrgProviderKey:
    vi.fn<(orgId: string, provider: string) => Promise<string | undefined>>(() => Promise.resolve("sk-test")),
  mockResolveOrgApiKey: vi.fn(
    async (_plaintext?: string): Promise<{ organizationId: string; keyId: string } | undefined> => undefined
  )
}));
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db/queries", () => ({ getOrgProviderKey: (...args: [string, string]) => mockGetOrgProviderKey(...args) }));
vi.mock("@/lib/db/api-keys", () => ({
  resolveOrgApiKey: (plaintext: string) => mockResolveOrgApiKey(plaintext)
}));
vi.mock("@/lib/db/custom-agents", () => ({
  getOrgCustomAgent: vi.fn(async () => undefined)
}));
vi.mock("@/lib/db/workspace", () => ({
  createAgentRun: vi.fn(async () => ({
    id: "run-1",
    organizationId: "test-org",
    userId: "test-user",
    agentType: "eng_lead",
    provider: "openai",
    model: "gpt-4o",
    prompt: "Review this code",
    status: "running",
    resultExcerpt: null,
    error: null,
    createdAt: new Date(),
    finishedAt: null
  })),
  finishAgentRun: vi.fn(async () => undefined),
  createNotification: vi.fn(async () => ({ id: "n-1" }))
}));

const { POST } = await import("@/app/api/orchestrate/route");

function makeRequest(body: unknown, headers?: HeadersInit) {
  return new NextRequest("http://localhost/api/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

const validBase = {
  provider: "openai",
  model: "gpt-4o",
  prompt: "Review this code",
  agentType: "eng_lead"
};

beforeEach(() => {
  resetRateLimiterForTests();
  vi.stubGlobal("fetch", vi.fn());
  mockGetOrgProviderKey.mockReset();
  mockGetOrgProviderKey.mockResolvedValue("sk-test");
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({
    user: { id: "test-user", email: "test@example.com", name: "Test User", isPlatformAdmin: false },
    organizationId: "test-org",
    organizationName: "Test Org",
    role: "owner" as const
  });
  mockResolveOrgApiKey.mockReset();
  mockResolveOrgApiKey.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/orchestrate - authentication", () => {
  it("rejects an unauthenticated request", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makeRequest(validBase));
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts a valid org API key Bearer token without a session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    mockResolveOrgApiKey.mockResolvedValueOnce({ organizationId: "test-org", keyId: "key-1" });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" } }] })
    });

    const res = await POST(
      makeRequest(validBase, { Authorization: "Bearer nx_live_testtokenvalue123456" })
    );
    expect(res.status).toBe(200);
    expect(mockResolveOrgApiKey).toHaveBeenCalled();
  });
});

describe("POST /api/orchestrate - validation", () => {
  it("rejects an unsupported provider", async () => {
    const res = await POST(makeRequest({ ...validBase, provider: "azure" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.type).toBe("error");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a blank prompt", async () => {
    const res = await POST(makeRequest({ ...validBase, prompt: "   " }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a prompt over the length limit", async () => {
    const { MAX_PROMPT_LENGTH } = await import("@/lib/validation");
    const res = await POST(makeRequest({ ...validBase, prompt: "a".repeat(MAX_PROMPT_LENGTH + 1) }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects context over the length limit", async () => {
    const { MAX_CONTEXT_LENGTH } = await import("@/lib/validation");
    const res = await POST(makeRequest({ ...validBase, context: "a".repeat(MAX_CONTEXT_LENGTH + 1) }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a model name over the length limit", async () => {
    const { MAX_MODEL_LENGTH } = await import("@/lib/validation");
    const res = await POST(makeRequest({ ...validBase, model: "m".repeat(MAX_MODEL_LENGTH + 1) }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an unknown agentType", async () => {
    const res = await POST(makeRequest({ ...validBase, agentType: "not_a_real_agent" }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a request when the org has no key configured for the provider", async () => {
    mockGetOrgProviderKey.mockResolvedValueOnce(undefined);
    const res = await POST(makeRequest(validBase));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/hasn't configured/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json"
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/orchestrate - direct specialist mode", () => {
  it("streams a status event followed by the specialist result", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "Looks good, minor nits." } }] })
    });

    const res = await POST(makeRequest(validBase));
    expect(res.status).toBe(200);

    const events = await readNdjson(res);
    expect(events[0]).toMatchObject({ type: "status" });
    const finalEvent = events.at(-1);
    expect(finalEvent).toMatchObject({ type: "final_result", content: "Looks good, minor nits." });
  });
});

describe("POST /api/orchestrate - rate limiting", () => {
  it("returns 429 once the limit is exceeded", async () => {
    let lastStatus = 200;
    // Invalid provider so each call fails validation fast without touching
    // fetch, but the rate limiter runs before validation so it still counts.
    for (let i = 0; i < 25; i++) {
      const res = await POST(makeRequest({ ...validBase, provider: "azure" }));
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
