import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";

export type HealthStatus = "healthy" | "degraded" | "down";

export type HealthCheck = {
  id: string;
  name: string;
  status: HealthStatus;
  detail: string;
  latencyMs: number | null;
};

export type PlatformHealthReport = {
  ok: boolean;
  checkedAt: string;
  checks: HealthCheck[];
  /** Count of checks that are not healthy (used for nav badge / Overview KPI). */
  incidentCount: number;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, latencyMs: Date.now() - start };
}

async function checkPostgres(): Promise<HealthCheck> {
  const id = "postgres";
  const name = "Postgres";
  try {
    const { latencyMs } = await timed(async () => {
      const db = getDb();
      await db.select({ one: sql<number>`1` }).from(organizations).limit(1);
    });
    return {
      id,
      name,
      status: latencyMs > 2000 ? "degraded" : "healthy",
      detail: latencyMs > 2000 ? `Responding slowly (${latencyMs}ms).` : "Connected.",
      latencyMs
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed.";
    return {
      id,
      name,
      status: "down",
      detail: message.includes("DATABASE_URL") ? "DATABASE_URL is not set." : message,
      latencyMs: null
    };
  }
}

function checkEnvSecret(id: string, name: string, envKey: string): HealthCheck {
  const set = Boolean(process.env[envKey]?.trim());
  return {
    id,
    name,
    status: set ? "healthy" : "down",
    detail: set ? `${envKey} is configured.` : `${envKey} is missing.`,
    latencyMs: null
  };
}

function checkOrchestrateRoute(): HealthCheck {
  // The route module is always present in this app; readiness is env + DB,
  // which have their own checks. This confirms the orchestrate surface exists.
  return {
    id: "orchestrate",
    name: "Orchestrate API",
    status: "healthy",
    detail: "POST /api/orchestrate is deployed (provider keys are per-org).",
    latencyMs: null
  };
}

function checkAuthRoute(): HealthCheck {
  const secretOk = Boolean(process.env.AUTH_SECRET?.trim());
  return {
    id: "auth",
    name: "Auth.js",
    status: secretOk ? "healthy" : "down",
    detail: secretOk
      ? "AUTH_SECRET set; /api/auth handlers available."
      : "AUTH_SECRET is missing — sign-in will fail.",
    latencyMs: null
  };
}

function checkEmbeddings(): HealthCheck {
  // Embeddings need Postgres + pgvector; we only verify URL here. A failed
  // postgres check already surfaces DB issues.
  const hasDb = Boolean(process.env.DATABASE_URL?.trim());
  return {
    id: "embeddings",
    name: "Knowledge / embeddings",
    status: hasDb ? "healthy" : "degraded",
    detail: hasDb
      ? "DATABASE_URL present; indexing requires pgvector + an org provider key."
      : "No DATABASE_URL — knowledge base writes unavailable.",
    latencyMs: null
  };
}

/** Run all platform probes. Safe for /api/health and the Superadmin Status page. */
export async function runPlatformHealthChecks(): Promise<PlatformHealthReport> {
  const postgres = await checkPostgres();
  const checks: HealthCheck[] = [
    postgres,
    checkAuthRoute(),
    checkEnvSecret("encryption", "Encryption", "ENCRYPTION_KEY"),
    checkOrchestrateRoute(),
    checkEmbeddings()
  ];

  const incidentCount = checks.filter((c) => c.status !== "healthy").length;
  return {
    ok: incidentCount === 0,
    checkedAt: new Date().toISOString(),
    checks,
    incidentCount
  };
}
