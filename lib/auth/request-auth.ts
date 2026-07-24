import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { resolveOrgApiKey } from "@/lib/db/api-keys";

export type RequestAuth =
  | { kind: "session"; userId: string; organizationId: string }
  | { kind: "api_key"; organizationId: string; keyId: string };

/**
 * Dual auth for selected public APIs: session cookie or `Authorization: Bearer nx_live_…`.
 */
export async function resolveRequestAuth(req: NextRequest | Request): Promise<RequestAuth | null> {
  const header =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-nexus-api-key")?.trim() ||
    "";
  if (header.startsWith("nx_live_")) {
    const resolved = await resolveOrgApiKey(header);
    if (resolved) {
      return { kind: "api_key", organizationId: resolved.organizationId, keyId: resolved.keyId };
    }
  }

  const session = await auth();
  if (session?.user?.id && session.organizationId) {
    return { kind: "session", userId: session.user.id, organizationId: session.organizationId };
  }
  return null;
}

export function authRateLimitKey(authCtx: RequestAuth): string {
  return authCtx.kind === "session" ? authCtx.userId : `key:${authCtx.keyId}`;
}
