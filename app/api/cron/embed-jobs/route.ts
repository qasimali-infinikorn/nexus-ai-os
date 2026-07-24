import { NextRequest, NextResponse } from "next/server";
import { processEmbedJobs } from "@/lib/db/embed-jobs";

export const runtime = "nodejs";

/**
 * Process pending Knowledge Base embed jobs.
 * Auth: `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const header =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-cron-secret")?.trim() ||
    "";
  if (header !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "5");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 20) : 5;
  const result = await processEmbedJobs(limit);
  return NextResponse.json({ ok: true, ...result });
}
