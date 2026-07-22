import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, GitPullRequest, AtSign, Sparkles, Bot, CircleCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { NOTIFICATION_KINDS, type NotificationKind } from "@/lib/db/schema";
import { countUnreadNotifications, listNotificationsForUser } from "@/lib/db/workspace";
import { markAllNotificationsReadAction } from "@/lib/actions/workspace";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Pill } from "@/components/workspace/ui";
import type { Tone } from "@/lib/workspace/content";

const FILTERS = ["All", ...NOTIFICATION_KINDS] as const;

const KIND_ICON = {
  Incidents: AlertTriangle,
  Reviews: GitPullRequest,
  Mentions: AtSign,
  Agents: Bot
} as const;

function asTone(value: string): Tone {
  const tones: Tone[] = ["green", "amber", "red", "blue", "slate", "violet"];
  return tones.includes(value as Tone) ? (value as Tone) : "slate";
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default async function NotificationsPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");

  const { filter = "All" } = await searchParams;
  const active = FILTERS.includes(filter as (typeof FILTERS)[number]) ? filter : "All";
  const kind = active === "All" ? "All" : (active as NotificationKind);

  const [list, unread] = await Promise.all([
    listNotificationsForUser({
      organizationId: session.organizationId,
      userId: session.user.id,
      kind
    }),
    countUnreadNotifications(session.organizationId, session.user.id)
  ]);

  const today = list.filter((n) => isToday(n.createdAt));
  const earlier = list.filter((n) => !isToday(n.createdAt));
  const groups: { label: string; items: typeof list }[] = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (earlier.length) groups.push({ label: "Earlier", items: earlier });

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${unread} unread`}
        actions={
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="segmented">
              {FILTERS.map((f) => (
                <Link key={f} href={`/notifications?filter=${f}`} className={f === active ? "active" : ""}>
                  {f}
                </Link>
              ))}
            </div>
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="btn-secondary btn-sm">
                Mark all read
              </button>
            </form>
          </div>
        }
      />

      {groups.map(({ label, items }) => (
        <section key={label} className="stack-md">
          <p className="section-label">{label}</p>
          <Card>
            <div className="list">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Sparkles;
                const tone = asTone(n.tone);
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    className="list-row"
                    style={{
                      alignItems: "flex-start",
                      gap: 14,
                      boxShadow: n.unread ? "inset 3px 0 0 var(--accent)" : undefined
                    }}
                  >
                    <span
                      className={`stat-icon ${tone === "red" ? "red" : tone === "violet" ? "violet" : tone === "green" ? "green" : "blue"}`}
                      style={{ width: 32, height: 32, flexShrink: 0 }}
                    >
                      <Icon size={15} aria-hidden />
                    </span>
                    <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <span className="title">{n.title}</span>
                        {n.badge ? <Pill tone={tone}>{n.badge}</Pill> : null}
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
                      <CircleCheck
                        size={15}
                        aria-hidden
                        style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 6 }}
                      />
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
