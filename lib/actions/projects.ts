"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createProject,
  createProjectTask,
  moveProjectTask,
  updateProjectTask,
  writeAuditLog
} from "@/lib/db/queries";
import { PROJECT_STATUSES, TASK_KINDS, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/db/schema";

export type TaskFormState = { error?: string; success?: string; ref?: string } | undefined;

/**
 * Every action re-verifies the session itself — proxy.ts only does
 * optimistic redirects, and Server Actions are reachable as POST endpoints
 * independently of any page (see docs/AUTH.md).
 */
async function requireOrg() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) throw new Error("Authentication required.");
  return { userId: session.user.id, organizationId: session.organizationId };
}

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5_000;

const createSchema = z.object({
  projectSlug: z.string().min(1).max(100),
  refPrefix: z.string().min(1).max(8),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(MAX_TITLE),
  description: z.string().max(MAX_DESCRIPTION).optional(),
  kind: z.enum(TASK_KINDS),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  points: z.coerce.number().int().min(0).max(100),
  assignee: z.string().trim().min(1).max(40)
});

export async function createTaskAction(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const { organizationId, userId } = await requireOrg();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const d = parsed.data;
  const initials = d.assignee
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const task = await createProjectTask({
    organizationId,
    projectSlug: d.projectSlug,
    refPrefix: d.refPrefix,
    kind: d.kind,
    title: d.title,
    description: d.description,
    status: d.status,
    priority: d.priority,
    points: d.points,
    assignee: initials || "??",
    // Stable per-person tint: same initials always get the same colour.
    avatarIndex: Math.abs([...initials].reduce((a, c) => a + c.charCodeAt(0), 0)) % 6
  });

  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "project_task.created",
    targetType: "project_task",
    targetId: task.ref
  });

  revalidatePath(`/projects/${d.projectSlug}`);
  return { success: `${task.ref} created.`, ref: task.ref };
}

const moveSchema = z.object({
  ref: z.string().min(1).max(40),
  projectSlug: z.string().min(1).max(100),
  status: z.enum(TASK_STATUSES),
  position: z.coerce.number().int().min(0).max(500)
});

/** Called by the Kanban board after a drag (or a keyboard move). */
export async function moveTaskAction(input: {
  ref: string;
  projectSlug: string;
  status: string;
  position: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { organizationId, userId } = await requireOrg();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid move." };

  const moved = await moveProjectTask({
    organizationId,
    ref: parsed.data.ref,
    status: parsed.data.status,
    position: parsed.data.position
  });
  if (!moved) return { ok: false, error: "Task not found." };

  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "project_task.moved",
    targetType: "project_task",
    targetId: parsed.data.ref,
    metadata: { status: parsed.data.status }
  });

  revalidatePath(`/projects/${parsed.data.projectSlug}`);
  return { ok: true };
}

const updateSchema = z.object({
  ref: z.string().min(1).max(40),
  projectSlug: z.string().min(1).max(100),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(MAX_TITLE),
  description: z.string().max(MAX_DESCRIPTION).optional(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  points: z.coerce.number().int().min(0).max(100)
});

export async function updateTaskAction(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const { organizationId, userId } = await requireOrg();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const d = parsed.data;
  const updated = await updateProjectTask({
    organizationId,
    ref: d.ref,
    title: d.title,
    description: d.description,
    status: d.status,
    priority: d.priority,
    points: d.points
  });
  if (!updated) return { error: "Task not found." };

  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "project_task.updated",
    targetType: "project_task",
    targetId: d.ref
  });

  revalidatePath(`/projects/${d.projectSlug}`);
  revalidatePath(`/projects/${d.projectSlug}/tasks/${d.ref}`);
  return { success: "Task saved." };
}

/* ── Projects ─────────────────────────────────────────────────────────── */

export type ProjectFormState = { error?: string; slug?: string } | undefined;

const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters.").max(80),
  key: z
    .string()
    .trim()
    .min(2, "Key must be 2-6 characters.")
    .max(6, "Key must be 2-6 characters.")
    .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Key must be letters/digits and start with a letter."),
  lead: z.string().trim().min(2, "Lead is required.").max(60),
  status: z.enum(PROJECT_STATUSES),
  sprintLabel: z.string().trim().min(1).max(60),
  engineers: z.coerce.number().int().min(1, "At least one engineer.").max(500)
});

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const { organizationId, userId } = await requireOrg();
  const parsed = createProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const project = await createProject({ organizationId, ...parsed.data });

  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "project.created",
    targetType: "project",
    targetId: project.slug,
    metadata: { name: project.name, key: project.key }
  });

  revalidatePath("/projects");
  return { slug: project.slug };
}
