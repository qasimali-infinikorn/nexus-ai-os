"use client";

import React from "react";
import { Loader2, type LucideIcon } from "lucide-react";

type StatusTone = "live" | "success" | "error" | "idle";

export function StatusLine({
  message,
  tone = "idle"
}: {
  message: string;
  tone?: StatusTone;
}) {
  if (!message) return null;

  const className =
    tone === "error"
      ? "status-line error"
      : tone === "success"
        ? "status-line success"
        : "status-line";

  return (
    <div className={className} role="status">
      <div
        className={`pulse-indicator${tone === "live" ? " live" : ""}`}
        aria-hidden
        style={
          tone === "error"
            ? { background: "var(--accent-red)" }
            : tone === "success"
              ? { background: "var(--accent)" }
              : undefined
        }
      />
      <span>{message}</span>
    </div>
  );
}

export function RunButton({
  loading,
  disabled,
  onClick,
  idleLabel,
  loadingLabel,
  type = "button"
}: {
  loading: boolean;
  disabled?: boolean;
  onClick?: () => void;
  idleLabel: string;
  loadingLabel: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className="btn-primary"
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" size={16} aria-hidden />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <span>{idleLabel}</span>
      )}
    </button>
  );
}

export function AgentPanel({
  icon: Icon,
  title,
  badge,
  badgeClass = "badge-sky",
  children
}: {
  icon: LucideIcon;
  title: string;
  badge: string;
  badgeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel" aria-label={title}>
      <div className="card-header">
        <div className="card-header-title">
          <Icon aria-hidden size={18} style={{ color: "var(--accent-sky)" }} />
          <h3>{title}</h3>
        </div>
        <span className={`badge ${badgeClass}`}>{badge}</span>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

export function OutputBlock({
  title,
  badge,
  actions,
  children
}: {
  title?: string;
  badge?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="output-panel">
      {(title || badge || actions) && (
        <div className="output-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {title ? <h4>{title}</h4> : null}
            {badge ? <span className="badge badge-green">{badge}</span> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/** Maps a free-form status string to a visual tone. */
export function statusTone(status: string, loading: boolean): StatusTone {
  if (!status) return "idle";
  if (loading) return "live";
  const lower = status.toLowerCase();
  if (lower.includes("error") || lower.includes("fail")) return "error";
  if (
    lower.includes("complete") ||
    lower.includes("ready") ||
    lower.includes("generated") ||
    lower.includes("success")
  ) {
    return "success";
  }
  return "idle";
}
