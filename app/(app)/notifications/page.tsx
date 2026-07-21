import Link from "next/link";
import { AlertTriangle, GitPullRequest, AtSign, Sparkles, CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Pill, DemoNotice } from "@/components/workspace/ui";
import { notifications, notificationFilters } from "@/lib/workspace/content";

const KIND_ICON = { Incidents: AlertTriangle, Reviews: GitPullRequest, Mentions: AtSign };

export default async function NotificationsPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "All" } = await searchParams;
  const active = notificationFilters.includes(filter) ? filter : "All";
  const list = active === "All" ? notifications : notifications.filter((n) => n.kind === active);
  const unread = notifications.filter((n) => n.unread).length;

  const groups = list.reduce<Record<string, typeof list>>((acc, n) => {
    (acc[n.group] ||= []).push(n);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${unread} unread`}
        actions={
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="segmented">
              {notificationFilters.map((f) => (
                <Link key={f} href={`/notifications?filter=${f}`} className={f === active ? "active" : ""}>
                  {f}
                </Link>
              ))}
            </div>
            <button type="button" className="btn-secondary btn-sm">
              Mark all read
            </button>
          </div>
        }
      />

      <DemoNotice>
        Demo notifications. Real ones appear here as GitHub, PagerDuty, and agent events are wired up.
      </DemoNotice>

      {Object.entries(groups).map(([group, items]) => (
        <section key={group} className="stack-md">
          <p className="section-label">{group}</p>
          <Card>
            <div className="list">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind as keyof typeof KIND_ICON] ?? Sparkles;
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    className="list-row"
                    style={{
                      alignItems: "flex-start",
                      gap: 14,
                      // Unread is carried by the trailing dot + a hairline
                      // accent edge rather than a full row tint, so a mostly
                      // unread list doesn't read as one solid block of color.
                      boxShadow: n.unread ? "inset 3px 0 0 var(--accent)" : undefined
                    }}
                  >
                    <span
                      className={`stat-icon ${n.tone === "red" ? "red" : n.tone === "violet" ? "violet" : n.tone === "green" ? "green" : "blue"}`}
                      style={{ width: 32, height: 32, flexShrink: 0 }}
                    >
                      <Icon size={15} aria-hidden />
                    </span>
                    <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <span className="title">{n.title}</span>
                        {n.badge ? <Pill tone={n.tone}>{n.badge}</Pill> : null}
                      </span>
                      <p className="dim" style={{ fontSize: "0.85rem", lineHeight: 1.55 }}>
                        {n.body}
                      </p>
                      <span className="meta">{n.ago}</span>
                    </div>
                    {n.unread ? (
                      <span
                        className="status-dot running"
                        style={{ marginTop: 8, flexShrink: 0 }}
                        aria-label="Unread"
                      />
                    ) : (
                      <CircleCheck size={15} aria-hidden style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 6 }} />
                    )}
                  </Link>
                );
              })}
            </div>
          </Card>
        </section>
      ))}

      {list.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>
          Nothing in this category.
        </p>
      ) : null}
    </>
  );
}
