import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ArchitectureStudio from "@/components/architecture-studio";
import { PageHeader } from "@/components/app-shell/page-header";
import { FeaturePanelHost } from "@/components/app-shell/feature-panel-host";

export default function DesignSystemPage() {
  return (
    <>
      <nav className="row" style={{ gap: 6, fontSize: "0.85rem" }} aria-label="Breadcrumb">
        <Link href="/architecture">Architecture Studio</Link>
        <ChevronRight size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        <span className="muted">Design a system</span>
      </nav>

      <PageHeader
        title="Design a system"
        description="Describe the requirements and workload; the Architect agent returns a component breakdown, Mermaid diagram, tradeoffs, and cost estimate."
      />

      <FeaturePanelHost Panel={ArchitectureStudio} />
    </>
  );
}
