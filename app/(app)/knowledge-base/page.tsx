import Link from "next/link";
import { Search, Sparkles, FolderGit, FileText } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Pill, DemoNotice } from "@/components/workspace/ui";
import { knowledgeResults, knowledgeSources, knowledgeStats } from "@/lib/workspace/content";

export default function KnowledgeBasePage() {
  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description={`Semantic search across ${knowledgeStats.sources} connected sources · ${knowledgeStats.documents} documents indexed`}
        actions={
          <Link href="/knowledge-base/manage" className="btn-primary">
            <Sparkles size={16} aria-hidden />
            <span>Ask AI</span>
          </Link>
        }
      />

      <DemoNotice>
        The source counts and results below are demo content. Your <em>real</em> indexed documents — stored in
        Postgres with pgvector — live in <Link href="/knowledge-base/manage">Documents</Link>, where Keyword and
        Semantic RAG questions run against them for real.
      </DemoNotice>

      <Card>
        <div className="card-pad">
          <label className="row" style={{ gap: 10, padding: "4px 2px" }} htmlFor="kb-search">
            <Search size={18} aria-hidden style={{ color: "var(--text-muted)" }} />
            <input
              id="kb-search"
              className="form-input"
              style={{ border: "none", background: "transparent", padding: 0, fontSize: "1rem" }}
              placeholder="Search standards, ADRs, runbooks, and repo docs…"
            />
            <Pill tone="blue">Semantic</Pill>
          </label>
        </div>
      </Card>

      <div className="segmented" style={{ flexWrap: "wrap" }}>
        {knowledgeSources.map((s, i) => (
          <button key={s.id} type="button" className={i === 0 ? "active" : ""}>
            {s.label} <span className="muted" style={{ marginLeft: 6 }}>{s.count}</span>
          </button>
        ))}
      </div>

      <Card>
        {knowledgeResults.map((r) => (
          <article key={r.id} className="result">
            <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <span className="row" style={{ gap: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                <FolderGit size={13} aria-hidden />
                {r.source}
              </span>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                {r.path}
              </span>
              <Pill tone="green">{r.match}</Pill>
            </div>
            <h3 className="card-title" style={{ fontSize: "0.95rem" }}>
              {r.title}
            </h3>
            <p className="snippet">{r.snippet}</p>
            <p className="meta" style={{ marginTop: 8 }}>
              {r.updated}
            </p>
          </article>
        ))}
      </Card>

      <Link href="/knowledge-base/manage" className="btn-secondary" style={{ alignSelf: "flex-start" }}>
        <FileText size={15} aria-hidden />
        <span>Manage your indexed documents</span>
      </Link>
    </>
  );
}
