import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { listPlatformAuditEvents } from "@/lib/db/queries";
import { Card } from "@/components/workspace/ui";
import { formatAdminDateTime } from "@/lib/workspace/admin-ui";

const ACTION_FILTERS = [
  { id: "all", label: "All", action: undefined },
  { id: "create", label: "Create", action: "platform.tenant.create" },
  { id: "suspend", label: "Suspend", action: "platform.tenant.suspend" },
  { id: "restore", label: "Restore", action: "platform.tenant.restore" }
] as const;

function actionLabel(action: string): string {
  switch (action) {
    case "platform.tenant.create":
      return "Created tenant";
    case "platform.tenant.suspend":
      return "Suspended tenant";
    case "platform.tenant.restore":
      return "Restored tenant";
    default:
      return action;
  }
}

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const selected = ACTION_FILTERS.find((f) => f.id === params.action) ?? ACTION_FILTERS[0];
  const events = await listPlatformAuditEvents({
    limit: 100,
    action: selected.action
  });

  return (
    <div className="stack-lg">
      <nav className="segmented" aria-label="Audit action filter">
        {ACTION_FILTERS.map((f) => {
          const href = f.id === "all" ? "/admin/audit" : `/admin/audit?action=${f.id}`;
          const active = selected.id === f.id;
          return (
            <Link key={f.id} href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              {f.label}
            </Link>
          );
        })}
      </nav>

      <Card className="table-scroll admin-table-card">
        {events.length === 0 ? (
          <p className="dim" style={{ padding: "1.25rem" }}>
            No platform audit events yet. Suspend, restore, or create a tenant to populate this feed.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const meta = (event.metadata ?? {}) as Record<string, unknown>;
                const name = typeof meta.name === "string" ? meta.name : null;
                return (
                  <tr key={event.id}>
                    <td className="dim" style={{ whiteSpace: "nowrap" }}>
                      {formatAdminDateTime(event.createdAt)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{event.actorName ?? "Unknown"}</div>
                      <div className="dim" style={{ fontSize: "0.75rem" }}>
                        {event.actorEmail ?? "—"}
                      </div>
                    </td>
                    <td>{actionLabel(event.action)}</td>
                    <td>
                      {event.targetType === "organization" && event.targetId ? (
                        <Link href={`/admin/tenants/${event.targetId}`}>
                          {name ?? event.targetId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="dim">
                          {event.targetType ?? "—"}
                          {event.targetId ? ` · ${event.targetId.slice(0, 8)}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
