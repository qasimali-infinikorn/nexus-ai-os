import { NextResponse } from "next/server";
import { runPlatformHealthChecks } from "@/lib/platform/health";

/**
 * Public liveness/readiness probe for operators and uptime monitors.
 * Does not expose secrets — only high-level check statuses.
 */
export async function GET() {
  const report = await runPlatformHealthChecks();
  const { openBanners: _banners, ...publicReport } = report;
  return NextResponse.json(publicReport, {
    status: report.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
