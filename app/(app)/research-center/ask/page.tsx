import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ResearchDigest from "@/components/research-digest";
import { PageHeader } from "@/components/app-shell/page-header";
import { FeaturePanelHost } from "@/components/app-shell/feature-panel-host";

export default function ResearchAskPage() {
  return (
    <>
      <nav className="row" style={{ gap: 6, fontSize: "0.85rem" }} aria-label="Breadcrumb">
        <Link href="/research-center">Research Center</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <span className="muted">New research</span>
      </nav>

      <PageHeader
        title="Run a research query"
        description="Compare stacks, plan migrations, and gauge enterprise readiness with the Tech Researcher agent."
      />

      <FeaturePanelHost Panel={ResearchDigest} />
    </>
  );
}
