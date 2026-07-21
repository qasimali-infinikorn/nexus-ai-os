import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Sparkles, ChevronRight } from "lucide-react";
import { Card, CardHead, Pill, DemoNotice } from "@/components/workspace/ui";
import { pullRequests } from "@/lib/workspace/content";

export function generateStaticParams() {
  return pullRequests.map((pr) => ({ number: String(pr.number) }));
}

const TONE_CLASS = { warn: "finding-warn", info: "finding-info", ok: "finding-ok" } as const;

function scoreColor(score: number) {
  if (score >= 90) return "#059669";
  if (score >= 75) return "#2563eb";
  if (score >= 60) return "#d97706";
  return "#dc2626";
}

export default async function PullRequestPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const pr = pullRequests.find((p) => String(p.number) === number);
  if (!pr) notFound();

  const stroke = scoreColor(pr.qualityScore);
  const circumference = 2 * Math.PI * 26;

  return (
    <>
      <nav className="row" style={{ gap: 6, fontSize: "0.85rem" }} aria-label="Breadcrumb">
        <Link href="/code-review">Pull requests</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <span className="muted">#{pr.number}</span>
      </nav>

      <header className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div className="stack">
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.5rem" }}>{pr.title}</h1>
            <Pill tone={pr.state === "approved" ? "green" : "amber"}>
              {pr.state === "approved" ? "Approved" : "Open"}
            </Pill>
          </div>
          <p className="dim" style={{ fontSize: "0.88rem" }}>
            <span className="strong">{pr.author}</span> wants to merge {pr.commits} commits into{" "}
            <code className="tag mono">{pr.baseBranch}</code> from <code className="tag mono">{pr.branch}</code>
          </p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn-secondary">
            Request changes
          </button>
          <button type="button" className="btn-primary" style={{ background: "#059669" }}>
            Approve &amp; merge
          </button>
        </div>
      </header>

      <DemoNotice>
        Demo pull request. To review your own code right now, paste a diff into{" "}
        <Link href="/code-review/new">the review runner</Link>{" "}&mdash; it calls your org&rsquo;s configured model.
      </DemoNotice>

      <div className="grid-4">
        {[
          { label: "Additions", value: `+${pr.additions}`, unit: "lines", color: "#059669" },
          { label: "Deletions", value: `-${pr.deletions}`, unit: "lines", color: "#dc2626" },
          { label: "Checks", value: pr.checks, unit: pr.checksOk ? "passing" : "1 failing", color: pr.checksOk ? "#059669" : "#d97706" },
          { label: "Coverage", value: pr.coverageDelta, unit: pr.coverageTotal, color: "#2563eb" }
        ].map((m) => (
          <div key={m.label} className="stat-card">
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 550 }}>{m.label}</span>
            <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
              <span className="stat-number" style={{ fontSize: "1.7rem", color: m.color }}>
                {m.value}
              </span>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                {m.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="with-rail" style={{ gridTemplateColumns: "320px minmax(0, 1fr)" }}>
        <Card as="aside">
          <CardHead title={`Files changed · ${pr.files.length}`} bordered />
          <div className="list">
            {pr.files.map((f) => (
              <div key={f.path} className="list-row" style={{ padding: "11px 20px", gap: 10 }}>
                <FileText size={15} aria-hidden style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span className="truncate mono" style={{ fontSize: "0.78rem", flex: 1 }}>
                  {f.path}
                </span>
                <span className="nowrap" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  <span style={{ color: "#059669" }}>+{f.additions}</span>{" "}
                  <span style={{ color: "#dc2626" }}>-{f.deletions}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="stack-lg">
          <Card>
            <CardHead
              title={
                <span className="row mono" style={{ gap: 8, fontSize: "0.85rem" }}>
                  <FileText size={15} aria-hidden />
                  {pr.diff.path}
                </span>
              }
              bordered
            />
            <div className="card-pad">
              <div className="diff">
                {pr.diff.lines.map((l, i) => (
                  <div key={i} className={`diff-line ${l.kind === "add" ? "add" : l.kind === "del" ? "del" : ""}`}>
                    <span className="ln">{pr.diff.startLine + i}</span>
                    <span className="ln" style={{ minWidth: 8 }}>
                      {l.kind === "add" ? "+" : l.kind === "del" ? "-" : " "}
                    </span>
                    <span className="code">{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {pr.findings.length ? (
            <Card>
              <CardHead
                title={
                  <span className="row" style={{ gap: 8 }}>
                    <Sparkles size={16} aria-hidden style={{ color: "var(--accent)" }} />
                    AI review · {pr.findings.length} comments
                  </span>
                }
                bordered
              />
              <div className="card-pad stack-md">
                {pr.findings.map((f) => (
                  <div key={f.id} className={`finding ${TONE_CLASS[f.tone]}`}>
                    <div className="head">
                      <span>
                        {f.kind}
                        {f.severity ? ` · ${f.severity}` : ""}
                      </span>
                      <code className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {f.location}
                      </code>
                    </div>
                    <p>{f.body}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="card-pad row" style={{ gap: 18, flexWrap: "wrap" }}>
              <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden style={{ flexShrink: 0 }}>
                <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke={stroke}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(pr.qualityScore / 100) * circumference} ${circumference}`}
                  transform="rotate(-90 32 32)"
                />
              </svg>
              <div className="stack" style={{ flex: 1, minWidth: 200 }}>
                <h3 className="card-title">Code quality score · {pr.qualityScore} / 100</h3>
                <p className="dim" style={{ fontSize: "0.86rem" }}>
                  {pr.qualitySummary}
                </p>
              </div>
              <div className="stack" style={{ textAlign: "right" }}>
                <span className="muted" style={{ fontSize: "0.76rem" }}>
                  Merge recommendation
                </span>
                <span className="strong" style={{ color: stroke }}>
                  {pr.mergeRecommendation}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
