import { requireFeatureFlag } from "@/lib/workspace/require-feature-flag";

export default async function AiWorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireFeatureFlag("ai-workspace");
  return children;
}
