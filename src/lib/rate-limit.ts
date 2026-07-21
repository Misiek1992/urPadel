// Minimal in-memory sliding-window rate limiter — zero dependencies, no
// external service. Scoped per Vercel serverless instance rather than
// globally, so it's a soft deterrent against casual abuse/accidental spam
// (e.g. a stuck client retry loop), not a hard guarantee under a real
// distributed attack. That trade-off is fine for this app's threat model
// (a public padel-club scoring form); a real abuse campaign would need a
// shared store (Upstash/Redis) keyed the same way.

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Sweep old buckets occasionally so this map doesn't grow unbounded across a
// long-lived serverless instance.
let lastSweep = Date.now();
function maybeSweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

/**
 * Returns true if `key` is allowed one more request within `limit` per
 * `windowMs`, recording this attempt either way.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  maybeSweep(windowMs);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return true;
}

/** Best-effort client identifier from standard proxy headers (Vercel sets these). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
