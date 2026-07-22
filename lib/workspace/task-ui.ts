// Presentation mapping for project tasks. The *values* (statuses, kinds,
// priorities) are owned by lib/db/schema.ts — this module only decides how
// each one looks, so there is no second copy of the enum to drift.

import { TASK_STATUSES, type TaskKind, type TaskPriority, type TaskStatus } from "@/lib/db/schema";
import type { Tone } from "./content";

export const STATUS_ORDER: readonly TaskStatus[] = TASK_STATUSES;

export const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  Critical: "red",
  High: "amber",
  Med: "blue",
  Low: "slate"
};

export const KIND_TONE: Record<TaskKind, Tone> = {
  story: "blue",
  bug: "red",
  task: "green"
};

/** Column dot + Timeline bar fill, mirroring the mockup's Gantt colouring. */
export const STATUS_BAR: Record<TaskStatus, string> = {
  "To Do": "#94a3b8",
  "In Progress": "#2563eb",
  "In Review": "#7c3aed",
  Done: "#059669"
};
