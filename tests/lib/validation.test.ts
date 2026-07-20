import { describe, it, expect } from "vitest";
import { isNonEmptyString, isValidProvider } from "@/lib/validation";

describe("isValidProvider", () => {
  it("accepts the three known providers", () => {
    expect(isValidProvider("openai")).toBe(true);
    expect(isValidProvider("anthropic")).toBe(true);
    expect(isValidProvider("google")).toBe(true);
  });

  it("rejects unknown or non-string values", () => {
    expect(isValidProvider("azure")).toBe(false);
    expect(isValidProvider("")).toBe(false);
    expect(isValidProvider(undefined)).toBe(false);
    expect(isValidProvider(null)).toBe(false);
    expect(isValidProvider(123)).toBe(false);
  });
});

describe("isNonEmptyString", () => {
  it("accepts non-blank strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  it("rejects blank, whitespace-only, and non-string values", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
  });
});
