import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ProposalCreator from "@/components/proposal-creator";
import { PageHeader } from "@/components/app-shell/page-header";
import { FeaturePanelHost } from "@/components/app-shell/feature-panel-host";

export default function NewProposalPage() {
  return (
    <>
      <nav className="row" style={{ gap: 6, fontSize: "0.85rem" }} aria-label="Breadcrumb">
        <Link href="/proposal-studio">Proposal Studio</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <span className="muted">Generate</span>
      </nav>

      <PageHeader
        title="Generate a proposal"
        description="Turn a problem spec into a client-ready proposal in business language with the Solution Consultant agent."
      />

      <FeaturePanelHost Panel={ProposalCreator} />
    </>
  );
}
