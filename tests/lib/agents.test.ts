import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callLLM } from "@/lib/agents";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

describe("callLLM", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws if no API key is provided", async () => {
    await expect(callLLM("openai", "gpt-4o", "", "sys", "user")).rejects.toThrow(/API key for openai is missing/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls the OpenAI chat completions endpoint with the key as a bearer token", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "hello from openai" } }] })
    );

    const result = await callLLM("openai", "gpt-4o", "sk-test", "sys prompt", "user prompt");

    expect(result).toBe("hello from openai");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("gpt-4o");
    expect(body.messages).toEqual([
      { role: "system", content: "sys prompt" },
      { role: "user", content: "user prompt" }
    ]);
  });

  it("calls the Anthropic messages endpoint with the key in x-api-key", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ content: [{ text: "hello from claude" }] })
    );

    const result = await callLLM("anthropic", "claude-3-5-sonnet-20241022", "sk-ant-test", "sys", "user");

    expect(result).toBe("hello from claude");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("sk-ant-test");
  });

  it("URL-encodes the model name and key in the Gemini request URL", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: "hello from gemini" }] } }] })
    );

    const result = await callLLM("google", "models/weird?evil=1", "key/with space", "sys", "user");

    expect(result).toBe("hello from gemini");
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/models%2Fweird%3Fevil%3D1:generateContent?key=key%2Fwith%20space"
    );
  });

  it("throws a descriptive error when the provider responds with a non-ok status", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({}, false, 401));

    await expect(callLLM("openai", "gpt-4o", "bad-key", "sys", "user")).rejects.toThrow(/OpenAI API returned error: 401/);
  });

  it("throws for an unsupported provider", async () => {
    // @ts-expect-error deliberately invalid provider to exercise the runtime guard
    await expect(callLLM("azure", "model", "key", "sys", "user")).rejects.toThrow(/Unsupported provider/);
  });
});
