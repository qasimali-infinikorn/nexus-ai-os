import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Sparkles,
  FileCode,
  Server,
  FolderGit,
  CalendarClock,
  ArrowRight,
  Check
} from "lucide-react";
import { auth } from "@/lib/auth";

const FEATURES = [
  {
    icon: FileCode,
    title: "Staff-level code review",
    body: "Paste a diff and get SOLID checks, debt estimates, and a score you can act on."
  },
  {
    icon: Server,
    title: "Architecture studio",
    body: "Turn requirements into system designs with Mermaid diagrams ready to export."
  },
  {
    icon: FolderGit,
    title: "Org knowledge that answers",
    body: "Index standards and ADRs, then ask RAG questions against your own docs."
  },
  {
    icon: CalendarClock,
    title: "Meeting and delivery ops",
    body: "Prep agendas, watch sprint health, and keep agents on the work that matters."
  }
] as const;

const STEPS = [
  { n: "01", title: "Create a workspace", body: "Invite your team and set org-level provider keys once." },
  { n: "02", title: "Route work to specialists", body: "Ask Nexus, or open a module — the coordinator picks the right agent." },
  { n: "03", title: "Ship with a paper trail", body: "Reviews, proposals, and research land where your team already works." }
] as const;

export default async function PublicHomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="public-page">
      <header className="public-nav">
        <Link href="/" className="public-nav-brand">
          <span className="auth-card-mark">
            <Sparkles size={16} strokeWidth={2.4} aria-hidden />
          </span>
          <span>Nexus</span>
        </Link>
        <nav className="public-nav-links" aria-label="Marketing">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="public-nav-actions">
          <Link href="/login" className="btn-secondary btn-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary btn-sm">
            Create workspace
          </Link>
        </div>
      </header>

      <main>
        <section className="public-hero" aria-labelledby="public-hero-title">
          <div className="public-hero-copy reveal">
            <p className="public-eyebrow">Engineering OS</p>
            <h1 id="public-hero-title">
              The AI operating system for engineering teams
            </h1>
            <p className="public-hero-lede">
              Ship faster with agents that review code, prep meetings, watch production, and keep
              your docs in sync — all in one workspace.
            </p>
            <div className="public-hero-cta">
              <Link href="/signup" className="btn-primary">
                Start free
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/login" className="btn-secondary">
                Sign in
              </Link>
            </div>
            <ul className="public-hero-points">
              <li>
                <Check size={14} aria-hidden /> Org-level BYOK — keys never hit the browser
              </li>
              <li>
                <Check size={14} aria-hidden /> Specialist agents for review, architecture, research
              </li>
              <li>
                <Check size={14} aria-hidden /> Built for technical leads and platform teams
              </li>
            </ul>
          </div>
          <div className="public-hero-visual reveal delay-1" aria-hidden>
            <div className="public-hero-panel">
              <div className="public-hero-panel-bar">
                <span />
                <span />
                <span />
              </div>
              <div className="public-hero-panel-body">
                <div className="public-hero-line accent" />
                <div className="public-hero-line" />
                <div className="public-hero-line short" />
                <div className="public-hero-chips">
                  <span>PR Review</span>
                  <span>Architecture</span>
                  <span>Knowledge</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="public-section">
          <div className="public-section-head reveal">
            <h2>Everything a tech lead needs in one OS</h2>
            <p>Specialist modules share one shell, one org key store, and one audit story.</p>
          </div>
          <div className="public-feature-grid">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className={`public-feature reveal delay-${(i % 3) + 1}`}>
                  <span className="public-feature-icon">
                    <Icon size={18} aria-hidden />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="how" className="public-section public-section-alt">
          <div className="public-section-head reveal">
            <h2>Up and running in three steps</h2>
            <p>No key pasted into localStorage. No separate tool for every workflow.</p>
          </div>
          <ol className="public-steps">
            {STEPS.map((s, i) => (
              <li key={s.n} className={`reveal delay-${i + 1}`}>
                <span className="public-step-n">{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="public-cta-band reveal">
          <h2>Ready to run your engineering OS?</h2>
          <p>Create a workspace and invite your team in minutes.</p>
          <Link href="/signup" className="btn-primary">
            Create workspace
            <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="public-footer">
        <span className="public-nav-brand">
          <span className="auth-card-mark">
            <Sparkles size={14} strokeWidth={2.4} aria-hidden />
          </span>
          Nexus
        </span>
        <p>© {new Date().getFullYear()} Nexus AI Engineering OS</p>
      </footer>
    </div>
  );
}
