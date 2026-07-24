import Link from "next/link";
import { GitPullRequest, Sparkles, Webhook } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card } from "@/components/workspace/ui";

const FILTERS = ["Open", "Merged", "All"] as const;

export default async function CodeReviewPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "Open" } = await searchParams;
  const active = FILTERS.includes(filter as (typeof FILTERS)[number]) ? filter : "Open";

  return (
    <>
      <PageHeader
        title="Pull requests"
        description="GitHub-connected PR inbox is not wired yet — review diffs with AI or ingest review webhooks."
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

      <Card>
        <div className="card-pad stack-lg" style={{ textAlign: "center", paddingBlock: 40 }}>
          <span className="stat-icon violet" style={{ width: 44, height: 44, marginInline: "auto" }}>
            <GitPullRequest size={20} aria-hidden />
          </span>
          <div className="stack" style={{ gap: 6, maxWidth: 420, marginInline: "auto" }}>
            <h3 className="card-title" style={{ fontSize: "1.05rem" }}>
              No pull requests yet
            </h3>
            <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
              Connecting a GitHub App will populate this list. Until then, paste a diff into the review runner, or
              point repo webhooks at Settings → Integrations for Reviews notifications.
            </p>
          </div>
          <div className="row" style={{ gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/code-review/new" className="btn-primary">
              <Sparkles size={15} aria-hidden />
              <span>Review a diff</span>
            </Link>
            <Link href="/settings/integrations" className="btn-secondary">
              <Webhook size={15} aria-hidden />
              <span>Review webhooks</span>
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}
