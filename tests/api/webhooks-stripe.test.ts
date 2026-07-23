import { createHmac } from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetRateLimiterForTests } from "@/lib/rate-limit";

const orgId = "00000000-0000-4000-8000-000000000001";

vi.mock("@/lib/db/billing", () => ({
  getOrganizationByStripeCustomerId: vi.fn(async (cus: string) =>
    cus === "cus_linked" ? { id: orgId, name: "Acme" } : undefined
  ),
  linkOrganizationStripeIds: vi.fn(async () => ({ id: orgId })),
  upsertBillingInvoice: vi.fn(async (row: { stripeInvoiceId: string }) => ({
    id: "inv-row",
    ...row
  })),
  clearOrganizationMrr: vi.fn(async () => undefined)
}));

vi.mock("@/lib/db/queries", () => ({
  getOrganizationById: vi.fn(async (id: string) =>
    id === orgId ? { id, name: "Acme" } : undefined
  ),
  writePlatformAuditEvent: vi.fn(async () => undefined)
}));

function sign(body: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${ts}.${body}`, "utf8").digest("hex");
  return `t=${ts},v1=${v1}`;
}

describe("handleStripeEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts invoices when organizationId is in customer metadata", async () => {
    const { handleStripeEvent } = await import("@/lib/integrations/stripe-events");
    const { upsertBillingInvoice } = await import("@/lib/db/billing");

    const result = await handleStripeEvent({
      type: "invoice.paid",
      dataObject: {
        id: "in_1",
        customer: "cus_new",
        amount_paid: 4900,
        currency: "usd",
        status: "paid",
        metadata: { organizationId: orgId },
        status_transitions: { paid_at: Math.floor(Date.now() / 1000) }
      }
    });

    expect(result).toEqual({ ok: true, organizationId: orgId });
    expect(upsertBillingInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: orgId,
        stripeInvoiceId: "in_1",
        amountCents: 4900,
        status: "paid"
      })
    );
  });

  it("updates MRR from subscription items via linked stripe customer", async () => {
    const { handleStripeEvent } = await import("@/lib/integrations/stripe-events");
    const { linkOrganizationStripeIds } = await import("@/lib/db/billing");

    const result = await handleStripeEvent({
      type: "customer.subscription.updated",
      dataObject: {
        id: "sub_1",
        customer: "cus_linked",
        status: "active",
        items: {
          data: [
            {
              quantity: 1,
              price: { unit_amount: 9900, recurring: { interval: "month", interval_count: 1 } }
            }
          ]
        }
      }
    });

    expect(result.organizationId).toBe(orgId);
    expect(linkOrganizationStripeIds).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: orgId,
        stripeCustomerId: "cus_linked",
        stripeSubscriptionId: "sub_1",
        mrrCents: 9900,
        status: "active"
      })
    );
  });

  it("clears MRR on subscription deleted", async () => {
    const { handleStripeEvent } = await import("@/lib/integrations/stripe-events");
    const { clearOrganizationMrr } = await import("@/lib/db/billing");

    await handleStripeEvent({
      type: "customer.subscription.deleted",
      dataObject: { id: "sub_1", customer: "cus_linked", status: "canceled" }
    });

    expect(clearOrganizationMrr).toHaveBeenCalledWith(orgId);
  });

  it("ignores events that cannot resolve an organization", async () => {
    const { handleStripeEvent } = await import("@/lib/integrations/stripe-events");
    const result = await handleStripeEvent({
      type: "invoice.paid",
      dataObject: { id: "in_x", customer: "cus_unknown", status: "paid", amount_paid: 1 }
    });
    expect(result).toEqual({ ok: true, ignored: true });
  });
});

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    resetRateLimiterForTests();
    vi.resetModules();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("accepts a signed invoice event", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const { upsertBillingInvoice } = await import("@/lib/db/billing");
    const body = JSON.stringify({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_route",
          customer: "cus_linked",
          amount_paid: 1000,
          status: "paid",
          currency: "usd"
        }
      }
    });
    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": sign(body, "whsec_test")
      },
      body
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(upsertBillingInvoice).toHaveBeenCalled();
  });

  it("rejects bad signatures", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const body = '{"type":"invoice.paid","data":{"object":{"id":"in_bad"}}}';
    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=deadbeef"
      },
      body
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});
