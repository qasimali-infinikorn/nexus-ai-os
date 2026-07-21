import Link from "next/link";
import { Sparkles, Server, Shield, Database, Users, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Pill, Avatar, Bar, DemoNotice } from "@/components/workspace/ui";
import { proposals, proposalTemplates, proposalStats } from "@/lib/workspace/content";

const TEMPLATE_ICON = { server: Server, shield: Shield, database: Database, users: Users };

function sectionsPct(sections: string) {
  const m = sections.match(/(\d+)\s+of\s+(\d+)/);
  if (!m) return 0;
  return (Number(m[1]) / Number(m[2])) * 100;
}

export default function ProposalStudioPage() {
  return (
    <>
      <PageHeader
        title="Proposal Studio"
        description={`${proposalStats.count} proposals · ${proposalStats.pipeline} in open pipeline · ${proposalStats.winRate} win rate`}
        actions={
          <Link href="/proposal-studio/new" className="btn-primary">
            <Sparkles size={16} aria-hidden />
            <span>Generate with AI</span>
          </Link>
        }
      />

      <DemoNotice>
        Demo pipeline. <strong>Generate with AI</strong>{" "}runs the real Solution Consultant agent against your
        org&rsquo;s configured model.
      </DemoNotice>

      <section className="stack-md">
        <p className="section-label">Start from a template</p>
        <div className="grid-4">
          {proposalTemplates.map((t) => {
            const Icon = TEMPLATE_ICON[t.icon];
            return (
              <Link
                key={t.id}
                href="/proposal-studio/new"
                className="card card-pad stack-md"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className="stat-icon blue" style={{ width: 38, height: 38 }}>
                  <Icon size={18} aria-hidden />
                </span>
                <div className="stack" style={{ gap: 3 }}>
                  <span className="card-title">{t.title}</span>
                  <span className="card-sub">{t.subtitle}</span>
                </div>
                <span className="row" style={{ gap: 5, fontSize: "0.8rem", fontWeight: 600, color: "var(--accent)" }}>
                  Use template <ArrowRight size={13} aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="stack-md">
        <p className="section-label">Your proposals</p>
        <Card>
          <div className="list">
            {proposals.map((p) => (
              <div key={p.id} className="list-row" style={{ gap: 16, flexWrap: "wrap" }}>
                <Avatar initials={p.initials} index={p.avatarIndex} size="lg" square />

                <div className="stack" style={{ flex: "1 1 240px", minWidth: 200 }}>
                  <span className="title">{p.title}</span>
                  <span className="meta">
                    {p.client} · {p.updated}
                  </span>
                </div>

                <div className="stack" style={{ flex: "1 1 150px", minWidth: 130, gap: 6 }}>
                  <span className="meta">{p.sections}</span>
                  <Bar pct={sectionsPct(p.sections)} />
                </div>

                <span className="strong nowrap" style={{ fontSize: "1rem" }}>
                  {p.value}
                </span>

                <Pill tone={p.tone}>{p.status}</Pill>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
