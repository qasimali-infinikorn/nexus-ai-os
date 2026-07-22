/**
 * Guardrail harness — asserts the security limits documented in
 * docs/SECURITY.md still match the implementation.
 */
import { describe, it, expect } from "vitest";
import {
  ALLOWED_PROVIDERS,
  MAX_CONTEXT_LENGTH,
  MAX_KNOWLEDGE_CONTENT_BYTES,
  MAX_KNOWLEDGE_NAME_LENGTH,
  MAX_KNOWLEDGE_QUERY_LENGTH,
  MAX_MODEL_LENGTH,
  MAX_PROMPT_LENGTH,
  isValidProvider
} from "@/lib/validation";
import { rateLimit, resetRateLimiterForTests } from "@/lib/rate-limit";
import fs from "fs";
import path from "path";

describe("guardrail harness", () => {
  it("keeps provider allowlist and length caps at documented values", () => {
    expect([...ALLOWED_PROVIDERS].sort()).toEqual(["anthropic", "google", "openai"]);
    expect(MAX_PROMPT_LENGTH).toBe(20_000);
    expect(MAX_CONTEXT_LENGTH).toBe(100_000);
    expect(MAX_MODEL_LENGTH).toBe(100);
    expect(MAX_KNOWLEDGE_NAME_LENGTH).toBe(200);
    expect(MAX_KNOWLEDGE_CONTENT_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_KNOWLEDGE_QUERY_LENGTH).toBe(500);
    expect(isValidProvider("openai")).toBe(true);
    expect(isValidProvider("evil")).toBe(false);
  });

  it("enforces orchestrate-style 20/min and knowledge write 30/min budgets", () => {
    resetRateLimiterForTests();
    for (let i = 0; i < 20; i++) {
      expect(rateLimit("orchestrate:user-a", 20, 60_000).allowed).toBe(true);
    }
    expect(rateLimit("orchestrate:user-a", 20, 60_000).allowed).toBe(false);

    resetRateLimiterForTests();
    for (let i = 0; i < 30; i++) {
      expect(rateLimit("knowledge:write:user-b", 30, 60_000).allowed).toBe(true);
    }
    expect(rateLimit("knowledge:write:user-b", 30, 60_000).allowed).toBe(false);
  });

  it("keeps webhook and health routes public in proxy.ts", () => {
    const proxy = fs.readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8");
    expect(proxy).toContain('pathname === "/api/health"');
    expect(proxy).toContain('pathname.startsWith("/api/webhooks/")');
  });

  it("documents WEBHOOK_SECRET auth on devops ingest", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "app/api/webhooks/devops/route.ts"),
      "utf8"
    );
    expect(route).toContain("WEBHOOK_SECRET");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("rateLimit");
  });

  it("documents GitHub HMAC and Jira webhook routes", () => {
    const github = fs.readFileSync(
      path.join(process.cwd(), "app/api/webhooks/github/route.ts"),
      "utf8"
    );
    const jira = fs.readFileSync(path.join(process.cwd(), "app/api/webhooks/jira/route.ts"), "utf8");
    expect(github).toContain("x-hub-signature-256");
    expect(github).toContain("GITHUB_WEBHOOK_SECRET");
    expect(jira).toContain("JIRA_WEBHOOK_SECRET");
    expect(jira).toContain("organizationId");
  });
});
