import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/orchestrate/route";
import { resetRateLimiterForTests } from "@/lib/rate-limit";
import { readNdjson } from "../helpers/stream";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const validBase = {
  provider: "openai",
  model: "gpt-4o",
  prompt: "Review this code",
  agentType: "eng_lead",
  keys: { openai: "sk-test" }
};

beforeEach(() => {
  resetRateLimiterForTests();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("rejects a request missing the provider's API key", async () => {
    const res = await POST(makeRequest({ ...validBase, keys: {} }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/API Key/);
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
