import { redirect } from "next/navigation";
import { CreditCard, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { listOrgMembers } from "@/lib/db/queries";
import { Card, CardHead, Pill, Bar, DemoNotice } from "@/components/workspace/ui";
import { billing } from "@/lib/workspace/settings-content";

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  // Seats assigned is real (actual members); the plan and invoices are demo
  // until a payment provider is connected.
  const members = await listOrgMembers(session.organizationId);
  const assigned = members.length;
  const pct = Math.round((assigned / billing.seatsTotal) * 100);

  return (
    <div className="stack-lg">
      <DemoNotice>
        Plan and invoices are demo content — no payment provider is connected. Seats assigned reflects your real
        member count.
      </DemoNotice>

      <Card>
        <div className="card-pad row-between" style={{ flexWrap: "wrap", gap: 20 }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="row" style={{ gap: 10 }}>
              <span className="stat-icon blue">
                <CreditCard size={16} aria-hidden />
              </span>
              <span className="card-title">{billing.planName}</span>
            </span>
            <span className="row" style={{ gap: 8, alignItems: "baseline" }}>
              <span className="stat-number">{billing.price}</span>
              <span className="muted">{billing.cadence}</span>
            </span>
            <span className="card-sub">
              {billing.renews} · {billing.seatsTotal} seats
            </span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn-secondary" disabled title="Connect a payment provider first">
              Change plan
            </button>
            <button type="button" className="btn-primary" disabled title="Connect a payment provider first">
              Add seats
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Seat usage" sub={`${assigned} of ${billing.seatsTotal} seats assigned`} bordered />
        <div className="card-pad stack-md">
          <Bar pct={pct} tone={pct > 90 ? "amber" : "green"} />
          <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
            {billing.seatsTotal - assigned} seats available. Invite teammates from Settings → Team.
          </p>
        </div>
      </Card>

      <Card>
        <CardHead title="Recent invoices" bordered />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Invoice</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Download</span></th>
              </tr>
            </thead>
            <tbody>
              {billing.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="dim">{inv.date}</td>
                  <td className="mono">{inv.id}</td>
                  <td className="strong">{inv.amount}</td>
                  <td><Pill tone="green">{inv.status}</Pill></td>
                  <td>
                    <button type="button" className="icon-btn" aria-label={`Download ${inv.id}`} disabled>
                      <Download size={14} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
