import { requireFeatureFlag } from "@/lib/workspace/require-feature-flag";

export default async function ProposalStudioLayout({ children }: { children: React.ReactNode }) {
  await requireFeatureFlag("proposal-studio");
  return children;
}
