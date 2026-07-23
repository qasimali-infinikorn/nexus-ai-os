import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { __setDbForTests, type Database } from "@/lib/db/client";
import { createUserAndOrg } from "@/lib/db/queries";
import { listOrgBillingInvoices, upsertBillingInvoice } from "@/lib/db/billing";
import { auditLog, billingInvoices, invitations, memberships, organizations, users } from "@/lib/db/schema";
import { createTestDb } from "../helpers/testDb";

let testDb: Database;

beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  __setDbForTests(testDb);
  await testDb.delete(billingInvoices);
  await testDb.delete(auditLog);
  await testDb.delete(invitations);
  await testDb.delete(memberships);
  await testDb.delete(users);
  await testDb.delete(organizations);
});

describe("listOrgBillingInvoices", () => {
  it("returns only that organization's invoices, newest first", async () => {
    const a = await createUserAndOrg({
      email: "bill-a@example.com",
      name: "A",
      passwordHash: "h",
      organizationName: "Bill A"
    });
    const b = await createUserAndOrg({
      email: "bill-b@example.com",
      name: "B",
      passwordHash: "h",
      organizationName: "Bill B"
    });

    await upsertBillingInvoice({
      organizationId: a.organization.id,
      stripeInvoiceId: "in_a_old",
      amountCents: 1000,
      status: "paid",
      paidAt: new Date("2026-01-01T00:00:00Z")
    });
    await upsertBillingInvoice({
      organizationId: a.organization.id,
      stripeInvoiceId: "in_a_new",
      amountCents: 2500,
      status: "open"
    });
    await upsertBillingInvoice({
      organizationId: b.organization.id,
      stripeInvoiceId: "in_b",
      amountCents: 9999,
      status: "paid"
    });

    const rows = await listOrgBillingInvoices(a.organization.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.stripeInvoiceId)).toEqual(["in_a_new", "in_a_old"]);
    expect(rows.every((r) => r.organizationId === a.organization.id)).toBe(true);
  });
});
