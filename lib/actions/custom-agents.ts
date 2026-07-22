"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createOrgCustomAgent, deleteOrgCustomAgent } from "@/lib/db/custom-agents";
import { writeAuditLog } from "@/lib/db/queries";

export type CustomAgentFormState = { error?: string; success?: string } | undefined;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) throw new Error("Authentication required.");
  if (session.role !== "owner" && session.role !== "admin") {
    throw new Error("Only owners and admins can manage custom agents.");
  }
  return { userId: session.user.id, organizationId: session.organizationId };
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(8).max(280),
  systemPrompt: z.string().trim().min(40).max(20_000),
  accent: z.enum(["blue", "green", "amber", "red", "violet"]).optional()
});

export async function createCustomAgentAction(
  _prev: CustomAgentFormState,
  formData: FormData
): Promise<CustomAgentFormState> {
  try {
    const { userId, organizationId } = await requireAdmin();
    const parsed = createSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

    const agent = await createOrgCustomAgent({
      organizationId,
      createdByUserId: userId,
      name: parsed.data.name,
      description: parsed.data.description,
      systemPrompt: parsed.data.systemPrompt,
      accent: parsed.data.accent
    });

    await writeAuditLog({
      organizationId,
      actorUserId: userId,
      action: "custom_agent.create",
      targetType: "org_custom_agent",
      targetId: agent.id,
      metadata: { key: agent.key, name: agent.name }
    });

    revalidatePath("/agents");
    return { success: `Created ${agent.name}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create agent." };
  }
}

export async function deleteCustomAgentAction(formData: FormData): Promise<void> {
  const { userId, organizationId } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteOrgCustomAgent(organizationId, id);
  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "custom_agent.delete",
    targetType: "org_custom_agent",
    targetId: id
  });
  revalidatePath("/agents");
}
