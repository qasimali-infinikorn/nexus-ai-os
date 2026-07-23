import { NextRequest, NextResponse } from "next/server";
import {
  enforceWebhookRateLimit,
  resolveWebhookSecret
} from "@/lib/webhooks/auth";
import { verifyStripeSignature } from "@/lib/integrations/stripe";
import { handleStripeEvent } from "@/lib/integrations/stripe-events";

export const runtime = "nodejs";

/**
 * Stripe webhook → billing_invoices + organization MRR/status.
 *
 * Configure endpoint URL `/api/webhooks/stripe` with events:
 * invoice.*, customer.subscription.*
 *
 * Link orgs by Stripe Customer metadata `organizationId` or by storing
 * `organizations.stripe_customer_id` first.
 */
export async function POST(req: NextRequest) {
  const secret = resolveWebhookSecret("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 503 }
    );
  }

  const { allowed, retryAfterMs } = enforceWebhookRateLimit(req, "stripe");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const type = event.type;
  const dataObject = event.data?.object;
  if (!type || !dataObject) {
    return NextResponse.json({ error: "Malformed Stripe event." }, { status: 400 });
  }

  const result = await handleStripeEvent({ type, dataObject });
  return NextResponse.json(result);
}
