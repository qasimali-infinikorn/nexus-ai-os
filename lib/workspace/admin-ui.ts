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
