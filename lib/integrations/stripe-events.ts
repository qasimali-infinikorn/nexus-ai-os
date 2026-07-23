import {
  getOrganizationByStripeCustomerId,
  linkOrganizationStripeIds,
  upsertBillingInvoice,
  clearOrganizationMrr
} from "@/lib/db/billing";
import { getOrganizationById, writePlatformAuditEvent } from "@/lib/db/queries";
import {
  mapStripeSubscriptionStatus,
  mrrCentsFromSubscriptionItem
} from "@/lib/integrations/stripe";
import type { BillingInvoiceStatus, OrganizationPlanTier } from "@/lib/db/schema";

type StripeObject = Record<string, unknown>;

function asObj(value: unknown): StripeObject {
  return value && typeof value === "object" ? (value as StripeObject) : {};
}

function customerIdFrom(obj: StripeObject): string | null {
  const customer = obj.customer;
  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object" && typeof (customer as StripeObject).id === "string") {
    return (customer as StripeObject).id as string;
  }
  return null;
}

function organizationIdFromMetadata(obj: StripeObject): string | null {
  const meta = asObj(obj.metadata);
  const id = meta.organizationId ?? meta.organization_id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

async function resolveOrganizationId(obj: StripeObject): Promise<string | null> {
  const fromMeta = organizationIdFromMetadata(obj);
  if (fromMeta) {
    const org = await getOrganizationById(fromMeta);
    if (org) return org.id;
  }
  const customerId = customerIdFrom(obj);
  if (!customerId) return null;
  const byCustomer = await getOrganizationByStripeCustomerId(customerId);
  return byCustomer?.id ?? null;
}

function mapInvoiceStatus(status: unknown): BillingInvoiceStatus {
  switch (status) {
    case "draft":
    case "open":
    case "paid":
    case "void":
    case "uncollectible":
      return status;
    default:
      return "open";
  }
}

function planTierFromMetadata(obj: StripeObject): OrganizationPlanTier | undefined {
  const meta = asObj(obj.metadata);
  const tier = meta.planTier ?? meta.plan_tier;
  if (tier === "trial" || tier === "team" || tier === "business" || tier === "enterprise") {
    return tier;
  }
  return undefined;
}

function subscriptionMrrCents(sub: StripeObject): number {
  const itemsRoot = asObj(sub.items);
  const data = Array.isArray(itemsRoot.data) ? (itemsRoot.data as StripeObject[]) : [];
  return data.reduce((sum, item) => sum + mrrCentsFromSubscriptionItem(item as never), 0);
}

export async function handleStripeEvent(params: {
  type: string;
  dataObject: StripeObject;
}): Promise<{ ok: boolean; ignored?: boolean; organizationId?: string }> {
  const { type, dataObject } = params;

  if (type.startsWith("invoice.")) {
    const organizationId = await resolveOrganizationId(dataObject);
    if (!organizationId) return { ok: true, ignored: true };

    const stripeInvoiceId = String(dataObject.id ?? "");
    if (!stripeInvoiceId) return { ok: true, ignored: true };

    const amount =
      typeof dataObject.amount_paid === "number"
        ? dataObject.amount_paid
        : typeof dataObject.amount_due === "number"
          ? dataObject.amount_due
          : 0;

    const periodStart =
      typeof dataObject.period_start === "number" ? new Date(dataObject.period_start * 1000) : null;
    const periodEnd =
      typeof dataObject.period_end === "number" ? new Date(dataObject.period_end * 1000) : null;
    const status = mapInvoiceStatus(dataObject.status);
    const paidAt =
      status === "paid" && typeof dataObject.status_transitions === "object"
        ? (() => {
            const paid = asObj(dataObject.status_transitions).paid_at;
            return typeof paid === "number" ? new Date(paid * 1000) : new Date();
          })()
        : status === "paid"
          ? new Date()
          : null;

    await upsertBillingInvoice({
      organizationId,
      stripeInvoiceId,
      amountCents: amount,
      currency: typeof dataObject.currency === "string" ? dataObject.currency : "usd",
      status,
      periodStart,
      periodEnd,
      hostedInvoiceUrl:
        typeof dataObject.hosted_invoice_url === "string" ? dataObject.hosted_invoice_url : null,
      paidAt
    });

    const customerId = customerIdFrom(dataObject);
    if (customerId) {
      await linkOrganizationStripeIds({
        organizationId,
        stripeCustomerId: customerId,
        status: status === "uncollectible" ? "past_due" : undefined
      });
    }

    await writePlatformAuditEvent({
      actorUserId: null,
      action: "platform.billing.invoice",
      targetType: "billing_invoice",
      targetId: stripeInvoiceId,
      metadata: { organizationId, status, amountCents: amount, event: type }
    });

    return { ok: true, organizationId };
  }

  if (type.startsWith("customer.subscription.")) {
    const organizationId = await resolveOrganizationId(dataObject);
    if (!organizationId) return { ok: true, ignored: true };

    const customerId = customerIdFrom(dataObject);
    const subId = typeof dataObject.id === "string" ? dataObject.id : null;
    const mappedStatus = mapStripeSubscriptionStatus(
      typeof dataObject.status === "string" ? dataObject.status : undefined
    );
    const planTier = planTierFromMetadata(dataObject);

    if (type === "customer.subscription.deleted") {
      await clearOrganizationMrr(organizationId);
      await writePlatformAuditEvent({
        actorUserId: null,
        action: "platform.billing.subscription_deleted",
        targetType: "organization",
        targetId: organizationId,
        metadata: { stripeSubscriptionId: subId }
      });
      return { ok: true, organizationId };
    }

    const mrrCents = subscriptionMrrCents(dataObject);
    await linkOrganizationStripeIds({
      organizationId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      mrrCents,
      status: mappedStatus ?? undefined,
      planTier
    });

    await writePlatformAuditEvent({
      actorUserId: null,
      action: "platform.billing.subscription",
      targetType: "organization",
      targetId: organizationId,
      metadata: {
        stripeSubscriptionId: subId,
        mrrCents,
        status: mappedStatus,
        event: type
      }
    });

    return { ok: true, organizationId };
  }

  return { ok: true, ignored: true };
}
