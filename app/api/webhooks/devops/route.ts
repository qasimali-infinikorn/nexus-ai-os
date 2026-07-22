import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createDeployment,
  createIncident,
  createNotification
} from "@/lib/db/workspace";
import { DEPLOYMENT_STATUSES, INCIDENT_SEVERITIES } from "@/lib/db/schema";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

const deploySchema = z.object({
  type: z.literal("deployment"),
  organizationId: z.string().uuid(),
  service: z.string().trim().min(1).max(80),
  version: z.string().trim().min(1).max(80),
  status: z.enum(DEPLOYMENT_STATUSES),
  detail: z.string().trim().max(500).optional(),
  externalId: z.string().trim().max(120).optional()
});

const incidentSchema = z.object({
  type: z.literal("incident"),
  organizationId: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(2).max(160),
  severity: z.enum(INCIDENT_SEVERITIES),
  summary: z.string().trim().max(2000).optional(),
  externalId: z.string().trim().max(120).optional()
});

const bodySchema = z.discriminatedUnion("type", [deploySchema, incidentSchema]);

/**
 * CI / PagerDuty-style ingest. Authenticated with `WEBHOOK_SECRET` via
 * `Authorization: Bearer <secret>` or `x-nexus-webhook-secret`.
 * Not session-auth: external systems call this.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "WEBHOOK_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  const provided =
    req.headers.get("x-nexus-webhook-secret")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  if (!provided || !secretsEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { allowed, retryAfterMs } = rateLimit(
    `webhook:${getClientKey(req)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.type === "deployment") {
    const row = await createDeployment({
      organizationId: data.organizationId,
      service: data.service,
      version: data.version,
      status: data.status,
      detail: data.detail,
      externalId: data.externalId
    });
    if (data.status === "failed") {
      await createNotification({
        organizationId: data.organizationId,
        kind: "Incidents",
        title: `Deploy failed · ${data.service}`,
        body: `${data.version}${data.detail ? ` — ${data.detail}` : ""}`,
        href: "/devops",
        tone: "red",
        badge: "deploy"
      });
    }
    return NextResponse.json({ ok: true, id: row.id });
  }

  const incident = await createIncident({
    organizationId: data.organizationId,
    code: data.code,
    title: data.title,
    severity: data.severity,
    summary: data.summary,
    externalId: data.externalId
  });
  await createNotification({
    organizationId: data.organizationId,
    kind: "Incidents",
    title: `${data.code} · ${data.title}`,
    body: data.summary ?? `${data.severity} severity incident opened.`,
    href: "/devops",
    tone: data.severity === "critical" || data.severity === "high" ? "red" : "amber",
    badge: data.severity
  });
  return NextResponse.json({ ok: true, id: incident.id });
}
