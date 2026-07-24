import Link from "next/link";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardHead } from "@/components/workspace/ui";

export default function ArchitecturePage() {
  return (
    <>
      <PageHeader
        title="Architecture Studio"
        description="Design systems with the Architect agent — no sample maps or cost fiction."
        actions={
          <Link href="/architecture/design" className="btn-primary">
            <Wand2 size={15} aria-hidden />
            <span>Design a system</span>
          </Link>
        }
      />

      <Card>
        <CardHead title="System map" bordered />
        <div className="card-pad stack-md" style={{ maxWidth: 520 }}>
          <p className="dim" style={{ margin: 0, lineHeight: 1.55 }}>
            There is no saved architecture for this workspace yet. Use the design generator to produce a component
            breakdown, Mermaid diagram, tradeoffs, and cost estimate from your requirements — powered by your
            org&rsquo;s configured model.
          </p>
          <Link href="/architecture/design" className="btn-secondary" style={{ alignSelf: "flex-start" }}>
            <Wand2 size={15} aria-hidden />
            <span>Open design generator</span>
          </Link>
        </div>
      </Card>
    </>
  );
}
