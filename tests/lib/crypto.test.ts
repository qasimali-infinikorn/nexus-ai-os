import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret, hashPassword, verifyPassword, generateToken } from "@/lib/crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-only-encryption-key-do-not-use-in-prod";
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext value", () => {
    const ciphertext = encryptSecret("sk-super-secret-key");
    expect(ciphertext).not.toContain("sk-super-secret-key");
    expect(decryptSecret(ciphertext)).toBe("sk-super-secret-key");
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-value");
    expect(decryptSecret(b)).toBe("same-value");
  });

  it("throws on a malformed ciphertext", () => {
    expect(() => decryptSecret("not-a-valid-ciphertext")).toThrow();
  });

  it("throws when the auth tag was tampered with", () => {
    const ciphertext = encryptSecret("sk-super-secret-key");
    const [iv, authTag, body] = ciphertext.split(".");
    const tampered = `${iv}.${authTag.slice(0, -2)}xx.${body}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("never stores the password in plaintext", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
    expect(hash).not.toContain("correct-horse-battery-staple");
  });
});

describe("generateToken", () => {
  it("generates distinct, URL-safe tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
