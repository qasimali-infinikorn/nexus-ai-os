import { desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  billingInvoices,
  organizations,
  type BillingInvoice,
  type BillingInvoiceStatus,
  type Organization,
  type OrganizationPlanTier,
  type OrganizationStatus
} from "@/lib/db/schema";

export async function getOrganizationByStripeCustomerId(
  stripeCustomerId: string
): Promise<Organization | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row;
}

export async function linkOrganizationStripeIds(params: {
  organizationId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  mrrCents?: number | null;
  status?: OrganizationStatus;
  planTier?: OrganizationPlanTier;
}): Promise<Organization | undefined> {
  const db = getDb();
  const patch: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    mrrCents?: number | null;
    status?: OrganizationStatus;
    planTier?: OrganizationPlanTier;
  } = {};
  if (params.stripeCustomerId !== undefined) patch.stripeCustomerId = params.stripeCustomerId;
  if (params.stripeSubscriptionId !== undefined) {
    patch.stripeSubscriptionId = params.stripeSubscriptionId;
  }
  if (params.mrrCents !== undefined) patch.mrrCents = params.mrrCents;
  if (params.status) patch.status = params.status;
  if (params.planTier) patch.planTier = params.planTier;

  const [row] = await db
    .update(organizations)
    .set(patch)
    .where(eq(organizations.id, params.organizationId))
    .returning();
  return row;
}

export async function upsertBillingInvoice(params: {
  organizationId: string;
  stripeInvoiceId: string;
  amountCents: number;
  currency?: string;
  status: BillingInvoiceStatus;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  hostedInvoiceUrl?: string | null;
  paidAt?: Date | null;
}): Promise<BillingInvoice> {
  const db = getDb();
  const [row] = await db
    .insert(billingInvoices)
    .values({
      organizationId: params.organizationId,
      stripeInvoiceId: params.stripeInvoiceId,
      amountCents: params.amountCents,
      currency: params.currency ?? "usd",
      status: params.status,
      periodStart: params.periodStart ?? null,
      periodEnd: params.periodEnd ?? null,
      hostedInvoiceUrl: params.hostedInvoiceUrl ?? null,
      paidAt: params.paidAt ?? null,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: billingInvoices.stripeInvoiceId,
      set: {
        amountCents: params.amountCents,
        currency: params.currency ?? "usd",
        status: params.status,
        periodStart: params.periodStart ?? null,
        periodEnd: params.periodEnd ?? null,
        hostedInvoiceUrl: params.hostedInvoiceUrl ?? null,
        paidAt: params.paidAt ?? null,
        updatedAt: new Date()
      }
    })
    .returning();
  return row;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getPlatformBillingStats(): Promise<{
  mrrCents: number;
  arrCents: number;
  failedPaymentCount: number;
  invoiceCount: number;
  hasBillingData: boolean;
  recentInvoices: (BillingInvoice & { organizationName: string })[];
  mrrSeries: { label: string; cents: number }[];
}> {
  const db = getDb();

  const orgsWithMrr = await db
    .select({ mrrCents: organizations.mrrCents, status: organizations.status })
    .from(organizations)
    .where(isNotNull(organizations.mrrCents));

  const mrrCents = orgsWithMrr
    .filter((o) => o.status === "active")
    .reduce((sum, o) => sum + (o.mrrCents ?? 0), 0);

  const invoices = await db.select().from(billingInvoices);
  const failedPaymentCount = invoices.filter(
    (i) => i.status === "uncollectible" || i.status === "open"
  ).length;

  const recent = await db
    .select({
      invoice: billingInvoices,
      organizationName: organizations.name
    })
    .from(billingInvoices)
    .innerJoin(organizations, eq(billingInvoices.organizationId, organizations.id))
    .orderBy(desc(billingInvoices.createdAt))
    .limit(20);

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 11);
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const monthMap = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status !== "paid") continue;
    const when = inv.paidAt ?? inv.createdAt;
    if (when < since) continue;
    const key = monthKey(when);
    monthMap.set(key, (monthMap.get(key) ?? 0) + inv.amountCents);
  }

  const mrrSeries: { label: string; cents: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i);
    d.setUTCDate(1);
    const key = monthKey(d);
    const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).slice(0, 1);
    mrrSeries.push({ label, cents: monthMap.get(key) ?? 0 });
  }

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    failedPaymentCount,
    invoiceCount: invoices.length,
    hasBillingData: invoices.length > 0 || mrrCents > 0,
    recentInvoices: recent.map((r) => ({ ...r.invoice, organizationName: r.organizationName })),
    mrrSeries
  };
}

/** Tenant Settings → Billing: invoices for one organization. */
export async function listOrgBillingInvoices(
  organizationId: string,
  limit = 20
): Promise<BillingInvoice[]> {
  const db = getDb();
  const capped = Math.min(Math.max(limit, 1), 100);
  return db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.organizationId, organizationId))
    .orderBy(desc(billingInvoices.createdAt))
    .limit(capped);
}

export function formatUsdCents(cents: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(cents / 100);
}

export async function clearOrganizationMrr(organizationId: string): Promise<void> {
  const db = getDb();
  await db
    .update(organizations)
    .set({ mrrCents: null, stripeSubscriptionId: null })
    .where(eq(organizations.id, organizationId));
}
