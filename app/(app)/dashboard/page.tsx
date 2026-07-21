import Link from "next/link";
import {
  CalendarDays,
  GitPullRequest,
  Zap,
  AlertTriangle,
  Sparkles,
  FileText,
  Layers,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Check,
  Bot
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Card, CardHead, Pill, DemoNotice } from "@/components/workspace/ui";
import { AreaChart, Sparkline, GroupedBars, Donut } from "@/components/workspace/charts";
import {
  statCards,
  deploymentFrequency,
  sprintVelocity,
  aiActivity,
  recentActivity,
  aiSuggestions,
  myTasks,
  agentActivity,
  meetings,
  workspace
} from "@/lib/workspace/content";

const STAT_ICONS = { calendar: CalendarDays, git: GitPullRequest, zap: Zap, alert: AlertTriangle };
const FEED_ICONS = { git: GitPullRequest, sparkles: Sparkles, alert: AlertTriangle, doc: FileText, layers: Layers };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const needsAttention = myTasks.filter((t) => !t.done).length;

  return (
    <div className="with-rail paneled">
      <div className="stack-lg">
        <header className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="stack">
          <h1 style={{ fontSize: "var(--fs-h1)" }}>
            {greeting()}, {firstName}
          </h1>
          <p className="dim" style={{ fontSize: "0.9rem" }}>
            {workspace.today} · {workspace.sprint} · {needsAttention} items need your attention
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

        <DemoNotice>
          This workspace is preloaded with demo content so you can explore every screen. Live GitHub, CI, and
          calendar data replace it as those integrations are connected.
        </DemoNotice>

        <div className="grid-4">
            {statCards.map((s) => {
              const Icon = STAT_ICONS[s.icon];
              const TrendIcon = s.trend === "up" ? ArrowUp : ArrowDown;
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
                    <Sparkline
                      points={s.spark}
                      color={s.trend === "down" && s.id !== "prs" && s.id !== "alerts" ? "#dc2626" : "#2563eb"}
                    />
                  </div>
                  <p className="stat-note">{s.note}</p>
                  <div className="row" style={{ gap: 6 }}>
                    {s.trend !== "flat" ? (
                      <span className={`trend ${s.trend === "up" ? "trend-up" : "trend-down"}`}>
                        <TrendIcon size={12} aria-hidden />
                      </span>
                    ) : null}
                    <Pill tone={s.footTone}>{s.foot}</Pill>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="grid-charts">
            <Card>
              <CardHead
                title={deploymentFrequency.title}
                sub={deploymentFrequency.subtitle}
                action={<Pill tone="green">↑ {deploymentFrequency.delta}</Pill>}
              />
              <div className="card-pad">
                <AreaChart points={deploymentFrequency.points} labels={deploymentFrequency.labels} id="deploys" />
              </div>
            </Card>

            <Card>
              <CardHead title={sprintVelocity.title} sub={sprintVelocity.subtitle} />
              <div className="card-pad">
                <GroupedBars data={sprintVelocity.sprints} />
                <div className="legend" style={{ marginTop: 10 }}>
                  <span className="k">
                    <span className="sw" style={{ background: "#cbd5e1" }} /> Committed
                  </span>
                  <span className="k">
                    <span className="sw" style={{ background: "#2563eb" }} /> Completed
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid-bottom">
            <Card>
              <CardHead title="AI activity" sub={`Agent runs this week · ${aiActivity.total} total`} />
              <div
                className="card-pad row"
                style={{ gap: 18, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}
              >
                <Donut
                  segments={aiActivity.breakdown}
                  centerLabel={String(aiActivity.total)}
                  centerSub="runs"
                  size={124}
                />
                <div className="stack" style={{ gap: 8, flex: "1 1 150px", minWidth: 150 }}>
                  {aiActivity.breakdown.map((b) => (
                    <div key={b.label} className="row-between" style={{ fontSize: "0.8rem" }}>
                      <span className="row" style={{ gap: 7 }}>
                        <span className="sw" style={{ background: b.color, width: 9, height: 9, borderRadius: 3 }} />
                        <span className="dim">{b.label}</span>
                      </span>
                      <span className="strong">{b.value}%</span>
                    </div>
                  ))}
                </div>
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
                {recentActivity.map((e) => {
                  const Icon = FEED_ICONS[e.icon];
                  return (
                    <div key={e.id} className="feed-row">
                      <span className={`feed-icon stat-icon ${e.tone === "violet" ? "violet" : e.tone === "red" ? "red" : e.tone === "blue" ? "blue" : "green"}`}>
                        <Icon size={14} aria-hidden />
                      </span>
                      <div className="feed-body">
                        <span className="strong">{e.actor}</span> {e.verb}{" "}
                        <span className="strong">{e.target}</span>
                        <p className="feed-time">{e.ago}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHead
                title={
                  <span className="row" style={{ gap: 8 }}>
                    <Sparkles size={16} aria-hidden style={{ color: "var(--accent)" }} />
                    AI suggestions
                  </span>
                }
              />
              <div className="card-pad stack-md" style={{ paddingTop: 12 }}>
                {aiSuggestions.map((s) => (
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
      </div>

      <aside className="rail" aria-label="Today at a glance">
          <section className="rail-section">
            <p className="section-label">Today</p>
            {meetings.map((m) => (
              <div key={m.id} className="rail-card">
                <p className="t">{m.title}</p>
                <p className="s">
                  {m.time} · {m.duration} · {m.location}
                </p>
              </div>
            ))}
          </section>

          <section className="rail-section">
            <p className="section-label">My tasks</p>
            <Card>
              <div className="card-pad" style={{ paddingTop: 8, paddingBottom: 8 }}>
                {myTasks.map((t) => (
                  <div key={t.id} className={`check-row${t.done ? " done" : ""}`}>
                    <span className={`check-box${t.done ? " done" : ""}`} aria-hidden>
                      {t.done ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="check-text">{t.title}</span>
                    <span className="tag">{t.tag}</span>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="rail-section">
            <p className="section-label">Agent activity</p>
            <Card>
              <div className="card-pad" style={{ paddingTop: 12, paddingBottom: 12 }}>
                {agentActivity.map((a) => (
                  <div key={a.id} className="feed-row">
                    <span className="feed-icon stat-icon blue">
                      <Bot size={14} aria-hidden />
                    </span>
                    <div className="feed-body">
                      <span className="strong">{a.agent}</span> {a.body}
                      <p className="feed-time">{a.ago}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </aside>
    </div>
  );
}
