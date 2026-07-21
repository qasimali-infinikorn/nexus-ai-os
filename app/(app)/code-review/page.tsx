import Link from "next/link";
import { GitPullRequest, CircleCheck, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Pill, Avatar, DemoNotice } from "@/components/workspace/ui";
import { pullRequests, codeReviewStats } from "@/lib/workspace/content";

const FILTERS = ["Open", "Merged", "All"] as const;

const STATE_PILL = {
  review_requested: { tone: "amber" as const, label: "Review requested" },
  approved: { tone: "green" as const, label: "Approved" },
  merged: { tone: "violet" as const, label: "Merged" }
};

export default async function CodeReviewPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "Open" } = await searchParams;
  const active = FILTERS.includes(filter as (typeof FILTERS)[number]) ? filter : "Open";

  const list = pullRequests.filter((pr) => {
    if (active === "All") return true;
    if (active === "Merged") return pr.state === "merged";
    return pr.state !== "merged";
  });

  return (
    <>
      <PageHeader
        title="Pull requests"
        description={`${codeReviewStats.open} open · ${codeReviewStats.awaitingYou} awaiting your review · avg. review time ${codeReviewStats.avgReviewTime}`}
        actions={
          <div className="segmented">
            {FILTERS.map((f) => (
              <Link key={f} href={`/code-review?filter=${f}`} className={f === active ? "active" : ""}>
                {f}
              </Link>
            ))}
          </div>
        }
      />

      <DemoNotice>
        Demo pull requests. Connecting GitHub replaces this list with your real repositories — the AI review on
        each PR already runs against your org&rsquo;s provider key.
      </DemoNotice>

      <Card>
        <div className="list">
          {list.map((pr) => {
            const st = STATE_PILL[pr.state];
            return (
              <Link key={pr.number} href={`/code-review/${pr.number}`} className="list-row" style={{ gap: 14 }}>
                <span className="stat-icon violet" style={{ width: 34, height: 34 }}>
                  <GitPullRequest size={16} aria-hidden />
                </span>

                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span className="title truncate">{pr.title}</span>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </span>
                  <span className="meta">
                    #{pr.number} · {pr.repo} · {pr.openedAgo}
                  </span>
                </div>

                <span className="row nowrap" style={{ gap: 10, fontSize: "0.82rem", fontWeight: 600 }}>
                  <span style={{ color: "#059669" }}>+{pr.additions}</span>
                  <span style={{ color: "#dc2626" }}>-{pr.deletions}</span>
                </span>

                <span className="row nowrap" style={{ gap: 5, fontSize: "0.8rem" }}>
                  {pr.checksOk ? (
                    <CircleCheck size={14} aria-hidden style={{ color: "#059669" }} />
                  ) : (
                    <CircleAlert size={14} aria-hidden style={{ color: "#d97706" }} />
                  )}
                  <span className="muted">{pr.checks}</span>
                </span>

                <Avatar initials={pr.authorInitials} index={pr.avatarIndex} />
              </Link>
            );
          })}
        </div>
      </Card>

      {list.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>
          No pull requests match this filter.
        </p>
      ) : null}
    </>
  );
}
