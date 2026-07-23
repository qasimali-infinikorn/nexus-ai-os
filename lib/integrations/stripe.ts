import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify Stripe-Signature header (t=…,v1=…).
 * @see https://docs.stripe.com/webhooks/signatures
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSec = 300
): boolean {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

/** Map Stripe subscription status → org status when unambiguous. */
export function mapStripeSubscriptionStatus(
  status: string | undefined
): "active" | "past_due" | "trial" | null {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "trialing":
      return "trial";
    default:
      return null;
  }
}

/** Estimate MRR cents from a subscription item (amount × qty, normalized to month). */
export function mrrCentsFromSubscriptionItem(item: {
  quantity?: number | null;
  price?: {
    unit_amount?: number | null;
    recurring?: { interval?: string | null; interval_count?: number | null } | null;
  } | null;
}): number {
  const unit = item.price?.unit_amount ?? 0;
  const qty = item.quantity ?? 1;
  const interval = item.price?.recurring?.interval ?? "month";
  const count = item.price?.recurring?.interval_count ?? 1;
  const raw = unit * qty;
  if (interval === "year") return Math.round(raw / (12 * Math.max(count, 1)));
  if (interval === "week") return Math.round((raw * 52) / (12 * Math.max(count, 1)));
  if (interval === "day") return Math.round((raw * 365) / (12 * Math.max(count, 1)));
  return Math.round(raw / Math.max(count, 1));
}
