import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEmbeddings } from "@/lib/embeddings";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

describe("getEmbeddings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty array without calling fetch when given no texts", async () => {
    const result = await getEmbeddings("openai", "sk-test", []);
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws if no key is provided", async () => {
    await expect(getEmbeddings("openai", "", ["hello"])).rejects.toThrow(/API key for openai is missing/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls the OpenAI embeddings endpoint and returns vectors in input order", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        data: [
          { embedding: [0.2], index: 1 },
          { embedding: [0.1], index: 0 }
        ]
      })
    );

    const result = await getEmbeddings("openai", "sk-test", ["first", "second"]);

    expect(result).toEqual([[0.1], [0.2]]);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init.body).input).toEqual(["first", "second"]);
  });

  it("batches requests when given more texts than the batch size", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_url: string, init: RequestInit) => {
      const input = JSON.parse(init.body as string).input as string[];
      return jsonResponse({ data: input.map((_text, index) => ({ embedding: [index], index })) });
    });

    const texts = Array.from({ length: 150 }, (_, i) => `text-${i}`);
    const result = await getEmbeddings("openai", "sk-test", texts);

    expect(result).toHaveLength(150);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws a descriptive error on a non-ok response", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({}, false, 401));
    await expect(getEmbeddings("openai", "bad-key", ["hi"])).rejects.toThrow(/OpenAI embeddings API returned error: 401/);
  });

  it("throws for an unsupported provider", async () => {
    // @ts-expect-error deliberately invalid provider to exercise the runtime guard
    await expect(getEmbeddings("azure", "key", ["hi"])).rejects.toThrow(/Unsupported embedding provider/);
  });
});
