import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, Download, ExternalLink, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { getOrganizationById, listOrgMembers } from "@/lib/db/queries";
import { formatUsdCents, listOrgBillingInvoices } from "@/lib/db/billing";
import { stripeConfigured } from "@/lib/integrations/stripe";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { PLAN_LABELS, STATUS_LABELS, formatAdminDate, formatAdminDateTime } from "@/lib/workspace/admin-ui";
import type { BillingInvoiceStatus } from "@/lib/db/schema";
import type { Tone } from "@/lib/workspace/content";

function invoiceTone(status: BillingInvoiceStatus): Tone {
  switch (status) {
    case "paid":
      return "green";
    case "open":
      return "amber";
    case "draft":
      return "slate";
    case "void":
    case "uncollectible":
      return "red";
  }
}

function invoiceStatusLabel(status: BillingInvoiceStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "open":
      return "Open";
    case "draft":
      return "Draft";
    case "void":
      return "Void";
    case "uncollectible":
      return "Failed";
  }
}

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const [org, members, invoices] = await Promise.all([
    getOrganizationById(session.organizationId),
    listOrgMembers(session.organizationId),
    listOrgBillingInvoices(session.organizationId, 25)
  ]);

  if (!org) redirect("/login");

  const assigned = members.length;
  const configured = stripeConfigured();
  const hasStripeLink = Boolean(org.stripeCustomerId);
  const hasMrr = org.mrrCents != null;
  const planLabel = PLAN_LABELS[org.planTier];
  const statusLabel = STATUS_LABELS[org.status];

  return (
    <div className="stack-lg">
      <Card>
        <div className="card-pad row-between" style={{ flexWrap: "wrap", gap: 20 }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="row" style={{ gap: 10 }}>
              <span className="stat-icon blue">
                <CreditCard size={16} aria-hidden />
              </span>
              <span className="card-title">{planLabel} plan</span>
              <Pill
                tone={
                  org.status === "active"
                    ? "green"
                    : org.status === "trial"
                      ? "amber"
                      : org.status === "past_due"
                        ? "red"
                        : "slate"
                }
              >
                {statusLabel}
              </Pill>
            </span>
            <span className="row" style={{ gap: 8, alignItems: "baseline" }}>
              <span className="stat-number">
                {hasMrr ? formatUsdCents(org.mrrCents ?? 0) : "—"}
              </span>
              <span className="muted">{hasMrr ? "/ month" : "MRR not synced"}</span>
            </span>
            <span className="card-sub">
              {hasStripeLink
                ? "Linked to Stripe · invoices sync via webhook"
                : configured
                  ? "Stripe is configured on the platform — link a customer on this org to sync invoices"
                  : "No payment provider linked yet · plan tier is managed by your workspace admin"}
            </span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn-secondary" disabled title="Self-serve plan changes aren’t available yet">
              Change plan
            </button>
            <Link href="/settings/team" className="btn-primary">
              Manage team
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Team seats"
          sub={`${assigned} member${assigned === 1 ? "" : "s"} in this workspace`}
          bordered
        />
        <div className="card-pad stack-md">
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <span className="stat-icon violet" style={{ width: 36, height: 36 }}>
              <Users size={16} aria-hidden />
            </span>
            <div className="stack" style={{ gap: 2 }}>
              <span className="stat-number" style={{ fontSize: "1.4rem" }}>
                {assigned}
              </span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Seat limits aren’t metered yet — invite teammates from Settings → Team.
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Recent invoices" sub="Synced from Stripe when a customer is linked" bordered />
        {invoices.length === 0 ? (
          <p className="dim" style={{ padding: "1.25rem", margin: 0 }}>
            {hasStripeLink
              ? "No invoices synced yet. They appear after Stripe sends invoice webhooks."
              : "No invoices for this workspace. When Stripe is linked, paid and open invoices will show here."}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Invoice</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="dim">
                      {formatAdminDate(inv.paidAt ?? inv.periodEnd ?? inv.createdAt)}
                    </td>
                    <td className="mono" title={inv.stripeInvoiceId}>
                      {inv.stripeInvoiceId.slice(0, 18)}
                      {inv.stripeInvoiceId.length > 18 ? "…" : ""}
                    </td>
                    <td className="strong">{formatUsdCents(inv.amountCents, 2)}</td>
                    <td>
                      <Pill tone={invoiceTone(inv.status)}>{invoiceStatusLabel(inv.status)}</Pill>
                    </td>
                    <td>
                      {inv.hostedInvoiceUrl ? (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="icon-btn"
                          aria-label={`Open invoice ${inv.stripeInvoiceId}`}
                        >
                          <ExternalLink size={14} aria-hidden />
                        </a>
                      ) : (
                        <button type="button" className="icon-btn" disabled aria-label="No hosted invoice URL">
                          <Download size={14} aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {invoices.length > 0 ? (
          <p className="meta" style={{ padding: "0 1.25rem 1rem", margin: 0 }}>
            Updated {formatAdminDateTime(invoices[0].updatedAt)}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
