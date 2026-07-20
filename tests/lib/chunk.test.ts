import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/chunk";

describe("chunkText", () => {
  it("returns an empty array for blank content", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single chunk when content fits within maxChars", () => {
    expect(chunkText("short content", { maxChars: 1000 })).toEqual(["short content"]);
  });

  it("splits on paragraph boundaries without exceeding maxChars", () => {
    const paragraphs = ["a".repeat(40), "b".repeat(40), "c".repeat(40)];
    const content = paragraphs.join("\n\n");

    const chunks = chunkText(content, { maxChars: 50 });

    expect(chunks).toEqual(paragraphs);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
  });

  it("groups short paragraphs into the same chunk when they fit", () => {
    const content = ["one", "two", "three"].join("\n\n");
    const chunks = chunkText(content, { maxChars: 1000 });
    expect(chunks).toEqual(["one\n\ntwo\n\nthree"]);
  });

  it("hard-splits a single paragraph longer than maxChars", () => {
    const longParagraph = "x".repeat(250);
    const chunks = chunkText(longParagraph, { maxChars: 100 });

    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toBe(longParagraph);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });
});
