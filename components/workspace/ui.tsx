import type { ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/workspace/content";

export function Card({
  children,
  className = "",
  as: As = "section"
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  return <As className={`card ${className}`}>{children}</As>;
}

export function CardHead({
  title,
  sub,
  action,
  bordered = false
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div className={`card-head${bordered ? " bordered" : ""}`}>
      <div className="stack">
        <h3 className="card-title">{title}</h3>
        {sub ? <p className="card-sub">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Pill({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

/** Deterministic avatar tint so the same person keeps the same color. */
export function Avatar({
  initials,
  index = 0,
  size = "md",
  square = false
}: {
  initials: string;
  index?: number;
  size?: "md" | "lg";
  square?: boolean;
}) {
  return (
    <span
      className={`avatar av-${index % 6}${size === "lg" ? " avatar-lg" : ""}${square ? " avatar-sq" : ""}`}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function Bar({ pct, tone }: { pct: number; tone?: "green" | "amber" | "red" }) {
  return (
    <div className="bar">
      <span className={tone} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function IconTile({
  icon: Icon,
  accent = "blue",
  size = 16
}: {
  icon: LucideIcon;
  accent?: "blue" | "green" | "amber" | "red" | "violet";
  size?: number;
}) {
  return (
    <span className={`stat-icon ${accent}`}>
      <Icon size={size} aria-hidden />
    </span>
  );
}

/**
 * Marks a surface whose contents come from the seeded demo workspace
 * (lib/workspace/content.ts) rather than a live integration. Shown so the
 * numbers on screen are never mistaken for real production telemetry.
 */
export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <p className="demo-banner" role="note">
      <Info size={15} aria-hidden style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
