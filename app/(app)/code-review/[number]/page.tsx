import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import { Card } from "@/components/workspace/ui";

/** No persisted PR catalog yet — any deep link is unknown. */
export default async function PullRequestPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (!/^\d+$/.test(number)) notFound();

  return (
    <>
      <nav className="row" style={{ gap: 6, fontSize: "0.85rem" }} aria-label="Breadcrumb">
        <Link href="/code-review">Pull requests</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <span className="muted">#{number}</span>
      </nav>

      <Card>
        <div className="card-pad stack-md" style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: "1.35rem", margin: 0 }}>Pull request not available</h1>
          <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
            Nexus does not store a GitHub PR catalog yet. Paste a diff into the review runner to get an AI review
            with your org&rsquo;s provider key, or configure review webhooks under Integrations.
          </p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link href="/code-review/new" className="btn-primary">
              <Sparkles size={15} aria-hidden />
              <span>Review a diff</span>
            </Link>
            <Link href="/code-review" className="btn-secondary">
              Back to list
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}
