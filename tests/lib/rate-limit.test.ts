import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  assertLoginAttemptAllowed,
  getClientKey,
  getClientKeyFromHeaders,
  getRateLimitState,
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  rateLimit,
  recordFailedLoginAttempt,
  resetRateLimiterForTests
} from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimiterForTests();
    vi.useRealTimers();
  });

  it("allows requests up to the limit and blocks the next one", () => {
    const key = "test-key-1";
    for (let i = 0; i < 3; i++) {
      const result = rateLimit(key, 3, 60_000);
      expect(result.allowed).toBe(true);
    }

    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    expect(rateLimit("a", 1, 60_000).allowed).toBe(true);
    expect(rateLimit("a", 1, 60_000).allowed).toBe(false);
    expect(rateLimit("b", 1, 60_000).allowed).toBe(true);
  });

  it("resets the count after the window elapses", () => {
    vi.useFakeTimers();
    const key = "test-key-window";
    expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
    expect(rateLimit(key, 1, 1_000).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
    vi.useRealTimers();
  });

  it("getRateLimitState peeks without consuming", () => {
    expect(getRateLimitState("peek", 2, 60_000).remaining).toBe(2);
    rateLimit("peek", 2, 60_000);
    expect(getRateLimitState("peek", 2, 60_000).remaining).toBe(1);
    expect(getRateLimitState("peek", 2, 60_000).remaining).toBe(1);
  });
});

describe("login attempt rate limiting", () => {
  beforeEach(() => {
    resetRateLimiterForTests();
  });

  it("locks an email after LOGIN_EMAIL_LIMIT failures", () => {
    const ip = "203.0.113.10";
    const email = "Alex@Example.com";
    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i++) {
      expect(assertLoginAttemptAllowed(ip, email).ok).toBe(true);
      recordFailedLoginAttempt(ip, email);
    }
    expect(assertLoginAttemptAllowed(ip, email).ok).toBe(false);
    // Different email from same IP still allowed until IP bucket fills.
    expect(assertLoginAttemptAllowed(ip, "other@example.com").ok).toBe(true);
  });

  it("locks an IP after LOGIN_IP_LIMIT failures across emails", () => {
    const ip = "198.51.100.20";
    for (let i = 0; i < LOGIN_IP_LIMIT; i++) {
      recordFailedLoginAttempt(ip, `user${i}@example.com`);
    }
    expect(assertLoginAttemptAllowed(ip, "fresh@example.com").ok).toBe(false);
    expect(assertLoginAttemptAllowed("198.51.100.99", "fresh@example.com").ok).toBe(true);
  });
});

describe("getClientKey", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" }
    });
    expect(getClientKey(req)).toBe("203.0.113.5");
    expect(getClientKeyFromHeaders(req.headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "198.51.100.9" }
    });
    expect(getClientKey(req)).toBe("198.51.100.9");
  });

  it("falls back to a shared bucket key when no headers are present", () => {
    const req = new Request("http://localhost/");
    expect(getClientKey(req)).toBe("unknown-client");
  });
});
