import Link from "next/link";
import { Download, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardHead, Pill, DemoNotice } from "@/components/workspace/ui";
import { ServiceMap } from "@/components/workspace/charts";
import { architecture } from "@/lib/workspace/content";

const DOT: Record<string, string> = { red: "#ef4444", amber: "#f59e0b", green: "#10b981" };

export default function ArchitecturePage() {
  const { cost } = architecture;

  return (
    <>
      <PageHeader
        title="Architecture Studio"
        description={`${architecture.system} · ${architecture.services} services · last analyzed ${architecture.analyzedAgo}`}
        actions={
          <>
            <button type="button" className="btn-secondary">
              <Download size={15} aria-hidden />
              <span>Export diagram</span>
            </button>
            <button type="button" className="btn-primary">
              <RefreshCw size={15} aria-hidden />
              <span>Re-analyze</span>
            </button>
          </>
        }
      />

      <DemoNotice>
        Demo system map. To generate a real architecture from your own requirements, open{" "}
        <Link href="/architecture/design">the design generator</Link>{" "}&mdash; it produces Mermaid diagrams with your
        configured model.
      </DemoNotice>

      <div className="with-rail">
        <Card>
          <CardHead
            title="Microservice map"
            action={
              <span className="mono muted" style={{ fontSize: "0.75rem" }}>
                mermaid · live
              </span>
            }
            bordered
          />
          <div className="card-pad">
            <ServiceMap nodes={architecture.nodes} edges={architecture.edges} />
          </div>
        </Card>

        <div className="rail">
          <Card>
            <CardHead title="Risk analysis" bordered />
            <div className="card-pad stack-md">
              {architecture.risks.map((r) => (
                <div key={r.id} className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                  <span
                    className="status-dot"
                    style={{ background: DOT[r.tone] ?? "#94a3b8", marginTop: 7 }}
                    aria-hidden
                  />
                  <div className="stack" style={{ gap: 3 }}>
                    <span className="strong" style={{ fontSize: "0.87rem" }}>
                      {r.title}
                    </span>
                    <p className="dim" style={{ fontSize: "0.82rem", lineHeight: 1.55 }}>
                      {r.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Monthly cost estimate" bordered />
            <div className="card-pad stack-md">
              <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
                <span className="stat-number">{cost.total}</span>
                <Pill tone="green">↓ {cost.delta}</Pill>
              </div>
              <div className="stack-md">
                {cost.lines.map((l) => (
                  <div key={l.label} className="stack" style={{ gap: 5 }}>
                    <div className="row-between" style={{ fontSize: "0.82rem" }}>
                      <span className="dim">{l.label}</span>
                      <span className="strong">{l.value}</span>
                    </div>
                    <div className="bar">
                      <span style={{ width: `${l.pct}%`, background: l.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title={
                <span className="row" style={{ gap: 8 }}>
                  <Sparkles size={16} aria-hidden style={{ color: "var(--accent)" }} />
                  Technology recommendations
                </span>
              }
              bordered
            />
            <div className="card-pad">
              <ul className="stack-md" style={{ listStyle: "none" }}>
                {architecture.recommendations.map((r) => (
                  <li key={r} className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                    <span className="status-dot active" style={{ marginTop: 7 }} aria-hidden />
                    <span className="dim" style={{ fontSize: "0.85rem", lineHeight: 1.55 }}>
                      {r}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Link href="/architecture/design" className="btn-secondary" style={{ width: "100%" }}>
            <Wand2 size={15} aria-hidden />
            <span>Design a new system</span>
          </Link>
        </div>
      </div>
    </>
  );
}
