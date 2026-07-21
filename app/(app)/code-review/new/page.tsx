import Link from "next/link";
import { ChevronRight } from "lucide-react";
import PRReviewer from "@/components/pr-reviewer";
import { PageHeader } from "@/components/app-shell/page-header";
import { FeaturePanelHost } from "@/components/app-shell/feature-panel-host";

export default function NewReviewPage() {
  return (
    <>
      <nav className="row" style={{ gap: 6, fontSize: "0.85rem" }} aria-label="Breadcrumb">
        <Link href="/code-review">Pull requests</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <span className="muted">New review</span>
      </nav>

      <PageHeader
        title="Review a diff"
        description="Paste a git diff, PR contents, or source and the Engineering Lead agent reviews it against SOLID, security, and testing criteria."
      />

      <FeaturePanelHost Panel={PRReviewer} />
    </>
  );
}
