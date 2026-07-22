import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import type { Session } from "next-auth";

/**
 * Dual-check gate for Superadmin routes and mutations.
 * JWT `isPlatformAdmin` is optimistic (also used in proxy.ts); this always
 * re-reads `users.is_platform_admin` so a revoked flag takes effect immediately.
 */
export async function requirePlatformAdmin(): Promise<{ session: Session; user: User }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.isPlatformAdmin) {
    redirect("/dashboard");
  }

  const user = await getUserById(session.user.id);
  if (!user?.isPlatformAdmin) {
    redirect("/dashboard");
  }

  return { session, user };
}
