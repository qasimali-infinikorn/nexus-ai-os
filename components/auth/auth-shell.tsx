import { Sparkles } from "lucide-react";

const STATS = [
  { value: "128", label: "agent runs / wk" },
  { value: "99.2%", label: "success rate" },
  { value: "6", label: "active projects" }
] as const;

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel">
        <div className="auth-brand-panel-inner">
          <div className="auth-brand-logo">
            <span className="auth-brand-mark glass">
              <Sparkles size={18} strokeWidth={2.4} aria-hidden />
            </span>
            <span className="auth-brand-name">Nexus</span>
          </div>

          <div className="auth-brand-spacer" />

          <h1 className="auth-brand-headline">
            The AI operating system for engineering teams
          </h1>
          <p className="auth-brand-lede">
            Ship faster with agents that review code, prep meetings, watch production, and keep
            your docs in sync — all in one workspace.
          </p>

          <div className="auth-brand-stats">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="auth-brand-stat-value">{s.value}</div>
                <div className="auth-brand-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="auth-form-panel">{children}</div>
    </div>
  );
}
