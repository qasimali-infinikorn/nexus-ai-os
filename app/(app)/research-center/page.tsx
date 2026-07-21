import Link from "next/link";
import { Bookmark, Settings2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Card, Avatar, DemoNotice, Pill } from "@/components/workspace/ui";
import { researchItems, researchCategories, researchStats } from "@/lib/workspace/content";

export default async function ResearchCenterPage({
  searchParams
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c = "All" } = await searchParams;
  const active = researchCategories.includes(c) ? c : "All";
  const list = active === "All" ? researchItems : researchItems.filter((r) => r.category === active);

  return (
    <>
      <PageHeader
        title="Research Center"
        description={`Daily digest curated by Research Assistant · ${researchStats.digestDate} · ${researchStats.newCount} new`}
        actions={
          <>
            <button type="button" className="btn-secondary">
              <Bookmark size={15} aria-hidden />
              <span>Bookmarks ({researchStats.bookmarks})</span>
            </button>
            <button type="button" className="btn-secondary">
              <Settings2 size={15} aria-hidden />
              <span>Configure digest</span>
            </button>
          </>
        }
      />

      <DemoNotice>
        Demo digest. Run a live research query any time from{" "}
        <Link href="/research-center/ask">the research runner</Link>{" "}&mdash; it uses your org&rsquo;s configured model.
      </DemoNotice>

      <div className="segmented" style={{ flexWrap: "wrap" }}>
        {researchCategories.map((cat) => (
          <Link key={cat} href={`/research-center?c=${encodeURIComponent(cat)}`} className={cat === active ? "active" : ""}>
            {cat}
          </Link>
        ))}
      </div>

      <div className="grid-2">
        {list.map((r) => (
          <Card key={r.id}>
            <div className="card-pad stack-md">
              <div className="row" style={{ gap: 10 }}>
                <Avatar initials={r.initials} index={r.avatarIndex} square />
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <Pill tone="blue">{r.category}</Pill>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      {r.source} · {r.ago}
                    </span>
                  </span>
                </div>
              </div>

              <h3 className="card-title" style={{ lineHeight: 1.4 }}>
                {r.title}
              </h3>
              <p className="dim" style={{ fontSize: "0.86rem", lineHeight: 1.6 }}>
                {r.summary}
              </p>

              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn-secondary btn-sm">
                  <Sparkles size={13} aria-hidden />
                  <span>Summarize</span>
                </button>
                <button type="button" className="btn-ghost btn-sm">
                  <Bookmark size={13} aria-hidden />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: 24 }}>
          Nothing in this category today.
        </p>
      ) : null}
    </>
  );
}
