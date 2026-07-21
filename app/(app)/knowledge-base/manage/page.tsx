import Link from "next/link";
import { ChevronRight } from "lucide-react";
import KnowledgeBase from "@/components/knowledge-base";
import { PageHeader } from "@/components/app-shell/page-header";
import { FeaturePanelHost } from "@/components/app-shell/feature-panel-host";

export default function KnowledgeManagePage() {
  return (
    <>
      <nav className="row" style={{ gap: 6, fontSize: "0.85rem" }} aria-label="Breadcrumb">
        <Link href="/knowledge-base">Knowledge Base</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <span className="muted">Documents</span>
      </nav>

      <PageHeader
        title="Your indexed documents"
        description="Add markdown documents to this workspace and ask grounded RAG questions against them. Stored in Postgres with pgvector."
      />

      <FeaturePanelHost Panel={KnowledgeBase} />
    </>
  );
}
