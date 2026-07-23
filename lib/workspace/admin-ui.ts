import type { OrganizationPlanTier, OrganizationStatus } from "@/lib/db/schema";
import type { Tone } from "@/lib/workspace/content";

export const PLAN_LABELS: Record<OrganizationPlanTier, string> = {
  trial: "Trial",
  team: "Team",
  business: "Business",
  enterprise: "Enterprise"
};

export const STATUS_LABELS: Record<OrganizationStatus, string> = {
  trial: "Trial",
  active: "Active",
  past_due: "Past due",
  suspended: "Suspended"
};

export function statusTone(status: OrganizationStatus): Tone {
  switch (status) {
    case "active":
      return "green";
    case "trial":
      return "amber";
    case "past_due":
      return "red";
    case "suspended":
      return "slate";
  }
}

export function formatAdminDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatAdminDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

/** Compact relative timestamp for feed rows (e.g. "2h ago"). */
export function formatRelativeTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

/** Human label for org-scoped `audit_log.action` values. */
export function orgAuditActionLabel(
  action: string,
  metadata?: Record<string, unknown> | null,
  targetId?: string | null
): string {
  const meta = metadata ?? {};
  const email = typeof meta.email === "string" ? meta.email : null;
  const name = typeof meta.name === "string" ? meta.name : null;
  const provider =
    (typeof meta.provider === "string" ? meta.provider : null) ||
    (action.startsWith("org_provider_key.") ? targetId : null);
  const ref =
    (typeof meta.ref === "string" ? meta.ref : null) ||
    (action.startsWith("project_task.") ? targetId : null);

  switch (action) {
    case "invitation.created":
      return email ? `invited ${email}` : "created an invitation";
    case "org_provider_key.set":
      return provider ? `set the ${provider} provider key` : "set a provider key";
    case "org_provider_key.deleted":
      return provider ? `removed the ${provider} provider key` : "removed a provider key";
    case "organization.renamed":
      return name ? `renamed the workspace to ${name}` : "renamed the workspace";
    case "user.password_changed":
      return "changed their password";
    case "user.password_reset_requested":
      return "requested a password reset";
    case "user.password_reset_completed":
      return "completed a password reset";
    case "user.organization_switched":
      return "switched active organization";
    case "project.created":
      return name ? `created project ${name}` : "created a project";
    case "project_task.created":
      return ref ? `created task ${ref}` : "created a task";
    case "project_task.moved":
      return ref ? `moved task ${ref}` : "moved a task";
    case "project_task.updated":
      return ref ? `updated task ${ref}` : "updated a task";
    case "custom_agent.create":
      return name ? `created custom agent ${name}` : "created a custom agent";
    case "custom_agent.delete":
      return name ? `deleted custom agent ${name}` : "deleted a custom agent";
    case "integration.google_calendar.disconnect":
      return "disconnected Google Calendar";
    case "integration.microsoft_calendar.disconnect":
      return "disconnected Microsoft Calendar";
    case "integration.google_calendar.connect":
      return "connected Google Calendar";
    case "integration.microsoft_calendar.connect":
      return "connected Microsoft Calendar";
    default:
      return action.replace(/[._]/g, " ");
  }
}
