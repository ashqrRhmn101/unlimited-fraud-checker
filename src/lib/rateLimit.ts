/**
 * Tiny in-memory rate limiter (per-process). Good enough for a single-instance
 * merchant panel; for multi-instance deployments swap with Redis/Supabase.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }
}

/** Returns true when the request is allowed. */
export function hit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxAttempts;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `login:${ip}`;
}
