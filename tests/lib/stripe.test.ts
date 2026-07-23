import { createHmac } from "crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  verifyStripeSignature,
  stripeConfigured,
  mapStripeSubscriptionStatus,
  mrrCentsFromSubscriptionItem
} from "@/lib/integrations/stripe";
import { formatUsdCents } from "@/lib/db/billing";

function sign(body: string, secret: string, ts = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${ts}.${body}`, "utf8").digest("hex");
  return `t=${ts},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';

  it("accepts a valid signature within tolerance", () => {
    expect(verifyStripeSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it("rejects wrong secret, missing header, or stale timestamp", () => {
    expect(verifyStripeSignature(body, sign(body, secret), "other")).toBe(false);
    expect(verifyStripeSignature(body, null, secret)).toBe(false);
    const stale = Math.floor(Date.now() / 1000) - 600;
    expect(verifyStripeSignature(body, sign(body, secret, stale), secret)).toBe(false);
  });
});

describe("stripe helpers", () => {
  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("reports configured only when both secrets are set", () => {
    expect(stripeConfigured()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test";
    expect(stripeConfigured()).toBe(false);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec";
    expect(stripeConfigured()).toBe(true);
  });

  it("maps subscription statuses and normalizes MRR intervals", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("trial");
    expect(mapStripeSubscriptionStatus("canceled")).toBeNull();

    expect(
      mrrCentsFromSubscriptionItem({
        quantity: 2,
        price: { unit_amount: 1000, recurring: { interval: "month", interval_count: 1 } }
      })
    ).toBe(2000);

    expect(
      mrrCentsFromSubscriptionItem({
        quantity: 1,
        price: { unit_amount: 12000, recurring: { interval: "year", interval_count: 1 } }
      })
    ).toBe(1000);
  });

  it("formats USD cents without inventing decimals", () => {
    expect(formatUsdCents(0)).toBe("$0");
    expect(formatUsdCents(12_500)).toBe("$125");
    expect(formatUsdCents(12_599, 2)).toBe("$125.99");
  });
});
