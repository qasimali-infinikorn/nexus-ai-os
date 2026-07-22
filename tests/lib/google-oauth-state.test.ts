import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signGoogleOAuthState, verifyGoogleOAuthState } from "@/lib/integrations/google-oauth-state";

describe("Google Calendar OAuth state", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-for-oauth-state";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("round-trips a valid signed state", () => {
    const payload = { u: "user-1", o: "org-1", e: Date.now() + 60_000 };
    const state = signGoogleOAuthState(payload);
    expect(verifyGoogleOAuthState(state)).toEqual(payload);
  });

  it("rejects tampered signatures and expired payloads", () => {
    const state = signGoogleOAuthState({ u: "u", o: "o", e: Date.now() + 60_000 });
    expect(verifyGoogleOAuthState(state + "x")).toBeNull();
    expect(verifyGoogleOAuthState(state.slice(0, -2) + "aa")).toBeNull();

    const expired = signGoogleOAuthState({ u: "u", o: "o", e: Date.now() - 1 });
    expect(verifyGoogleOAuthState(expired)).toBeNull();
  });
});
