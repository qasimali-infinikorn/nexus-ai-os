// Simple in-memory rate limiter.
//
// Caveat: state lives in process memory, so limits reset on restart and are
// NOT shared across multiple server instances (e.g. serverless/multi-replica
// deployments). That's an acceptable trade-off for a single-process local
// tool; a real multi-instance deployment should move this to a shared store
// (Redis, etc.) instead.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Bound memory growth from unbounded distinct keys without needing a timer.
const MAX_TRACKED_KEYS = 5000;

function sweepExpired(now: number) {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);

  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - bucket.count), retryAfterMs: 0 };
}

// Best-effort client identifier. Falls back to a shared bucket when no
// forwarding headers are present (e.g. plain local dev), which still caps
// total local request volume even though it can't distinguish clients.
export function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown-client";
}

export function resetRateLimiterForTests() {
  buckets.clear();
}
