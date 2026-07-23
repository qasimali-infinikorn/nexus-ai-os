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

/** Failed login attempts per client IP within the window. */
export const LOGIN_IP_LIMIT = 20;
/** Failed login attempts per email within the window. */
export const LOGIN_EMAIL_LIMIT = 10;
export const LOGIN_RATE_WINDOW_MS = 15 * 60_000;

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

/** Read-only check — does not consume a slot. */
export function getRateLimitState(key: string, limit: number, _windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterMs: 0
  };
}

export function getClientKeyFromHeaders(headerSource: Headers): string {
  const forwarded = headerSource.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = headerSource.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown-client";
}

// Best-effort client identifier. Falls back to a shared bucket when no
// forwarding headers are present (e.g. plain local dev), which still caps
// total local request volume even though it can't distinguish clients.
export function getClientKey(req: Request): string {
  return getClientKeyFromHeaders(req.headers);
}

export function loginRateLimitKeys(ip: string, email: string): { ipKey: string; emailKey: string } {
  return {
    ipKey: `login:ip:${ip}`,
    emailKey: `login:email:${email.trim().toLowerCase()}`
  };
}

/** Reject before bcrypt when either IP or email bucket is already full. */
export function assertLoginAttemptAllowed(ip: string, email: string): { ok: true } | { ok: false } {
  const { ipKey, emailKey } = loginRateLimitKeys(ip, email);
  const ipState = getRateLimitState(ipKey, LOGIN_IP_LIMIT, LOGIN_RATE_WINDOW_MS);
  if (!ipState.allowed) return { ok: false };
  const emailState = getRateLimitState(emailKey, LOGIN_EMAIL_LIMIT, LOGIN_RATE_WINDOW_MS);
  if (!emailState.allowed) return { ok: false };
  return { ok: true };
}

/** Record a failed credentials attempt against IP + email buckets. */
export function recordFailedLoginAttempt(ip: string, email: string): void {
  const { ipKey, emailKey } = loginRateLimitKeys(ip, email);
  rateLimit(ipKey, LOGIN_IP_LIMIT, LOGIN_RATE_WINDOW_MS);
  rateLimit(emailKey, LOGIN_EMAIL_LIMIT, LOGIN_RATE_WINDOW_MS);
}

export function resetRateLimiterForTests() {
  buckets.clear();
}
