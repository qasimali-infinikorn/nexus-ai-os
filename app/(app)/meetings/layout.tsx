import { requireFeatureFlag } from "@/lib/workspace/require-feature-flag";

export default async function MeetingsLayout({ children }: { children: React.ReactNode }) {
  await requireFeatureFlag("live-meetings");
  return children;
}
