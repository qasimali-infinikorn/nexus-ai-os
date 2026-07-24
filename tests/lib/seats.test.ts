import { describe, it, expect } from "vitest";
import { PLAN_SEAT_LIMITS, seatLimitForPlan, seatsRemaining } from "@/lib/billing/seats";

describe("seat limits", () => {
  it("maps plan tiers to caps", () => {
    expect(seatLimitForPlan("trial")).toBe(PLAN_SEAT_LIMITS.trial);
    expect(seatLimitForPlan("enterprise")).toBe(PLAN_SEAT_LIMITS.enterprise);
    expect(seatLimitForPlan("unknown")).toBe(PLAN_SEAT_LIMITS.trial);
  });

  it("reports atLimit when used >= limit", () => {
    expect(seatsRemaining({ planTier: "trial", memberCount: 5 })).toMatchObject({
      limit: 5,
      remaining: 0,
      atLimit: true
    });
    expect(seatsRemaining({ planTier: "team", memberCount: 3 })).toMatchObject({
      remaining: 22,
      atLimit: false
    });
  });
});
