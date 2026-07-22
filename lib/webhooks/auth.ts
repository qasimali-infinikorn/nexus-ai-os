import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

export function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Prefer provider-specific secret; fall back to shared WEBHOOK_SECRET. */
export function resolveWebhookSecret(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function bearerOrHeaderSecret(req: Request): string {
  return (
    req.headers.get("x-nexus-webhook-secret")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    ""
  );
}

export function verifyHmacSha256(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expected = `sha256=${digest}`;
  try {
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseOrganizationId(req: NextRequest | Request): string | null {
  try {
    const url = "nextUrl" in req && req.nextUrl ? req.nextUrl : new URL(req.url);
    const fromQuery = url.searchParams.get("organizationId")?.trim();
    if (fromQuery && /^[0-9a-f-]{36}$/i.test(fromQuery)) return fromQuery;
  } catch {
    // fall through to header
  }
  const fromHeader = req.headers.get("x-nexus-organization-id")?.trim();
  if (fromHeader && /^[0-9a-f-]{36}$/i.test(fromHeader)) return fromHeader;
  return null;
}

export function enforceWebhookRateLimit(req: Request, bucket: string) {
  return rateLimit(`webhook:${bucket}:${getClientKey(req)}`, 60, 60_000);
}
