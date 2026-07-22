import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isFeatureEnabledForOrg } from "@/lib/db/feature-flags";

/** Redirects to dashboard when a feature flag is off for the active org. */
export async function requireFeatureFlag(key: string): Promise<void> {
  const session = await auth();
  if (!session?.organizationId) {
    redirect("/login");
  }
  const enabled = await isFeatureEnabledForOrg(session.organizationId, key);
  if (!enabled) {
    redirect(`/dashboard?flag=${encodeURIComponent(key)}`);
  }
}
