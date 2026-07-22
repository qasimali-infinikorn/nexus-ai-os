import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ListTodo,
  Zap,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Bot
} from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getDashboardStats,
  listMeetings,
  listAgentRuns,
  listIncidents,
  getDeploymentFrequency
} from "@/lib/db/workspace";
import { Card, CardHead, Pill } from "@/components/workspace/ui";
import { AreaChart } from "@/components/workspace/charts";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function padFrequency(rows: { day: string; count: number }[], days = 14): number[] {
  const map = new Map(rows.map((r) => [r.day, r.count]));
  const points: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    points.push(map.get(`${y}-${m}-${day}`) ?? 0);
  }
  return points;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) redirect("/login");

  const orgId = session.organizationId;
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const [stats, meetings, runs, incidents, frequency] = await Promise.all([
    getDashboardStats(orgId, session.user.id),
    listMeetings(orgId, 5),
    listAgentRuns(orgId, 8),
    listIncidents(orgId, { openOnly: true, limit: 5 }),
    getDeploymentFrequency(orgId, 14)
  ]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  const kpi = [
    {
      id: "meetings",
      href: "/meetings",
      label: "Meetings today",
      value: String(stats.meetingsToday),
      note: "On your calendar",
      foot: stats.meetingsToday ? "Upcoming" : "Clear",
      footTone: stats.meetingsToday ? ("blue" as const) : ("green" as const),
      accent: "blue" as const,
      icon: CalendarDays
    },
    {
      id: "tasks",
      href: "/projects",
      label: "Open tasks",
      value: String(stats.openTasks),
      note: "Across projects",
      foot: `${stats.sprintProgress}% done`,
      footTone: "slate" as const,
      accent: "violet" as const,
      icon: ListTodo
    },
    {
      id: "sprint",
      href: "/projects",
      label: "Sprint progress",
      value: `${stats.sprintProgress}%`,
      note: "Tasks completed",
      foot: stats.agentRuns7d ? `${stats.agentRuns7d} agent runs / 7d` : "No runs yet",
      footTone: "green" as const,
      accent: "green" as const,
      icon: Zap
    },
    {
      id: "incidents",
      href: "/devops",
      label: "Open incidents",
      value: String(stats.openIncidents),
      note: "Needs attention",
      foot: stats.openIncidents ? "Active" : "Clear",
      footTone: stats.openIncidents ? ("amber" as const) : ("green" as const),
      accent: "amber" as const,
      icon: AlertTriangle
    }
  ];

  type FeedItem = {
    id: string;
    at: number;
    actor: string;
    verb: string;
    target: string;
    ago: string;
    tone: "violet" | "red" | "blue" | "green";
    icon: "bot" | "alert";
  };

  const feed: FeedItem[] = [
    ...runs.map((r) => ({
      id: `run-${r.id}`,
      at: r.createdAt.getTime(),
      actor: r.agentType,
      verb: r.status === "failed" ? "failed on" : r.status === "running" ? "is running" : "finished",
      target: (r.resultExcerpt ?? r.prompt).slice(0, 60),
      ago: relativeTime(r.createdAt),
      tone: (r.status === "failed" ? "red" : "violet") as FeedItem["tone"],
      icon: "bot" as const
    })),
    ...incidents.map((i) => ({
      id: `inc-${i.id}`,
      at: i.createdAt.getTime(),
      actor: i.code,
      verb: i.status === "acknowledged" ? "acknowledged" : "opened",
      target: i.title,
      ago: relativeTime(i.createdAt),
      tone: "red" as const,
      icon: "alert" as const
    }))
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  const deployPoints = padFrequency(frequency, 14);
  const deployTotal = frequency.reduce((n, r) => n + r.count, 0);

  const suggestions = [
    {
      id: "s1",
      kind: "Action",
      body:
        stats.openIncidents > 0
          ? `${stats.openIncidents} open incident${stats.openIncidents === 1 ? "" : "s"} — review and acknowledge in DevOps.`
          : "No open incidents. Check recent deploys for regressions.",
      cta: "Open DevOps",
      href: "/devops"
    },
    {
      id: "s2",
      kind: "Prep",
      body:
        stats.meetingsToday > 0
          ? `You have ${stats.meetingsToday} meeting${stats.meetingsToday === 1 ? "" : "s"} today — prep agendas in Meeting Assistant.`
          : "No meetings today. Draft a proposal or run a code review.",
      cta: stats.meetingsToday > 0 ? "Open meetings" : "Ask Nexus",
      href: stats.meetingsToday > 0 ? "/meetings" : "/ai-workspace"
    }
  ];

  return (
    <div className="with-rail paneled">
      <div className="stack-lg">
        <header className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="stack">
            <h1 style={{ fontSize: "var(--fs-h1)" }}>
              {greeting()}, {firstName}
            </h1>
            <p className="dim" style={{ fontSize: "0.9rem" }}>
              {todayLabel} · {stats.openTasks} open tasks · {stats.unreadNotifications} unread
            </p>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/proposal-studio" className="btn-secondary">
              New proposal
            </Link>
            <Link href="/ai-workspace" className="btn-primary">
              <Sparkles size={16} aria-hidden />
              <span>Ask Nexus</span>
            </Link>
          </div>
        </header>

        <div className="grid-4">
          {kpi.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.id} href={s.href} className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="stat-top">
                  <span className={`stat-icon ${s.accent}`}>
                    <Icon size={16} aria-hidden />
                  </span>
                  <span>{s.label}</span>
                </div>
                <div className="stat-main">
                  <div className="stack">
                    <span className="stat-number">{s.value}</span>
                  </div>
                </div>
                <p className="stat-note">{s.note}</p>
                <div className="row" style={{ gap: 6 }}>
                  <Pill tone={s.footTone}>{s.foot}</Pill>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="grid-charts">
          <Card>
            <CardHead
              title="Deployment frequency"
              sub="Last 14 days"
              action={
                <Pill tone={deployTotal ? "green" : "slate"}>
                  {deployTotal} deploy{deployTotal === 1 ? "" : "s"}
                </Pill>
              }
            />
            <div className="card-pad">
              <AreaChart points={deployPoints.length ? deployPoints : [0]} id="deploys" />
            </div>
          </Card>

          <Card>
            <CardHead
              title="Recent activity"
              action={
                <Link href="/notifications" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  View all
                </Link>
              }
            />
            <div className="card-pad" style={{ paddingTop: 12 }}>
              {feed.length === 0 ? (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  No recent agent runs or incidents yet.
                </p>
              ) : (
                feed.map((e) => (
                  <div key={e.id} className="feed-row">
                    <span
                      className={`feed-icon stat-icon ${e.tone === "violet" ? "violet" : e.tone === "red" ? "red" : "blue"}`}
                    >
                      {e.icon === "bot" ? <Bot size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
                    </span>
                    <div className="feed-body">
                      <span className="strong">{e.actor}</span> {e.verb}{" "}
                      <span className="strong">{e.target}</span>
                      <p className="feed-time">{e.ago}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHead
            title={
              <span className="row" style={{ gap: 8 }}>
                <Sparkles size={16} aria-hidden style={{ color: "var(--accent)" }} />
                Suggested next steps
              </span>
            }
          />
          <div className="card-pad stack-md" style={{ paddingTop: 12 }}>
            {suggestions.map((s) => (
              <div key={s.id} className={`finding ${s.kind === "Action" ? "finding-warn" : "finding-info"}`}>
                <div className="head">{s.kind}</div>
                <p>{s.body}</p>
                <Link
                  href={s.href}
                  className="row"
                  style={{ gap: 5, marginTop: 8, fontWeight: 600, fontSize: "0.82rem" }}
                >
                  {s.cta} <ArrowRight size={13} aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <aside className="rail" aria-label="Today at a glance">
        <section className="rail-section">
          <p className="section-label">Meetings</p>
          {meetings.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No upcoming meetings.
            </p>
          ) : (
            meetings.map((m) => (
              <div key={m.id} className="rail-card">
                <p className="t">{m.title}</p>
                <p className="s">
                  {formatTime(m.startsAt)}
                  {m.location ? ` · ${m.location}` : ""}
                  {m.needsPrep ? " · needs prep" : ""}
                </p>
              </div>
            ))
          )}
          <Link href="/meetings" className="meta" style={{ fontWeight: 600 }}>
            View meetings →
          </Link>
        </section>

        <section className="rail-section">
          <p className="section-label">Open incidents</p>
          {incidents.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              None open.
            </p>
          ) : (
            incidents.map((i) => (
              <div key={i.id} className="rail-card">
                <p className="t">
                  {i.code} · {i.title}
                </p>
                <p className="s">
                  {i.severity} · {i.status} · {relativeTime(i.createdAt)}
                </p>
              </div>
            ))
          )}
          <Link href="/devops" className="meta" style={{ fontWeight: 600 }}>
            Open DevOps →
          </Link>
        </section>

        <section className="rail-section">
          <p className="section-label">Agent activity</p>
          <Card>
            <div className="card-pad" style={{ paddingTop: 12, paddingBottom: 12 }}>
              {runs.length === 0 ? (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  No recent runs.
                </p>
              ) : (
                runs.slice(0, 5).map((a) => (
                  <div key={a.id} className="feed-row">
                    <span className="feed-icon stat-icon blue">
                      <Bot size={14} aria-hidden />
                    </span>
                    <div className="feed-body">
                      <span className="strong">{a.agentType}</span> {a.status}
                      <p className="feed-time">{relativeTime(a.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
          <Link href="/agents" className="meta" style={{ fontWeight: 600 }}>
            View agents →
          </Link>
        </section>
      </aside>
    </div>
  );
}
