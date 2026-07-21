import type { LucideIcon } from "lucide-react";

/**
 * Honest placeholder for nav sections that are real routes (present in the
 * nav from day one, per the Phase 1 plan) but not yet backed by real data —
 * Agents, DevOps, Projects, Meetings, Notifications. Never fabricates
 * numbers; says plainly what phase brings the real version.
 */
export function ComingSoon({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="panel">
      <div className="empty-state">
        <Icon size={40} aria-hidden style={{ strokeWidth: 1.4, opacity: 0.7, color: "var(--accent)" }} />
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}
