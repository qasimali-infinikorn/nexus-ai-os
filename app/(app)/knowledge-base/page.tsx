import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { listOrgDocuments } from "@/lib/db/queries";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card } from "@/components/workspace/ui";
import { formatRelativeTime } from "@/lib/workspace/admin-ui";

export default async function KnowledgeBasePage() {
  const session = await auth();
  if (!session?.organizationId) redirect("/login");

  const docs = await listOrgDocuments(session.organizationId);

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description={
          docs.length === 0
            ? "No documents indexed yet — add markdown in Documents to search and ask grounded questions."
            : `${docs.length} document${docs.length === 1 ? "" : "s"} in this workspace`
        }
        actions={
          <Link href="/knowledge-base/manage" className="btn-primary">
            <Sparkles size={16} aria-hidden />
            <span>Documents &amp; ask</span>
          </Link>
        }
      />

      <Card>
        {docs.length === 0 ? (
          <p className="dim" style={{ padding: "1.25rem", margin: 0, lineHeight: 1.55 }}>
            Indexed documents live in Postgres (org-scoped). Open{" "}
            <Link href="/knowledge-base/manage">Documents</Link> to upload content and run Keyword or Semantic
            search.
          </p>
        ) : (
          <div className="list">
            {docs.map((doc) => {
              const snippet = doc.content.slice(0, 220) + (doc.content.length > 220 ? "…" : "");
              const bytes = Buffer.byteLength(doc.content, "utf8");
              return (
                <div key={doc.id} className="list-row" style={{ alignItems: "flex-start" }}>
                  <span className="stat-icon violet" style={{ width: 32, height: 32, flexShrink: 0 }}>
                    <FileText size={15} aria-hidden />
                  </span>
                  <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <span className="title mono">{doc.name}</span>
                    <span className="meta" style={{ whiteSpace: "normal" }}>
                      {snippet}
                    </span>
                    <span className="meta">
                      {bytes.toLocaleString()} bytes · updated {formatRelativeTime(doc.updatedAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Link href="/knowledge-base/manage" className="btn-secondary" style={{ alignSelf: "flex-start" }}>
        <FileText size={15} aria-hidden />
        <span>Manage indexed documents</span>
      </Link>
    </>
  );
}
