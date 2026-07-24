/**
 * Stripe Billing Customer Portal — opens Stripe-hosted invoice/payment UI.
 * Requires STRIPE_SECRET_KEY and a linked organizations.stripe_customer_id.
 */

export async function createStripeBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string } | { error: string }> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return { error: "Stripe is not configured on this deployment." };

  const body = new URLSearchParams({
    customer: params.customerId,
    return_url: params.returnUrl
  });

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) {
    return { error: data.error?.message ?? "Could not open the Stripe billing portal." };
  }
  return { url: data.url };
}
