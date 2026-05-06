// Lightweight client-side rate limiter to prevent accidental spam.
// Server enforcement is the source of truth; this exists for UX.

type Bucket = { times: number[] };
const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Max actions allowed within windowMs */
  max: number;
  /** Sliding window in milliseconds */
  windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  like: { max: 30, windowMs: 10_000 },     // 30 likes per 10s
  comment: { max: 5, windowMs: 30_000 },   // 5 comments per 30s
  share: { max: 10, windowMs: 30_000 },    // 10 shares per 30s
  report: { max: 5, windowMs: 60_000 },    // 5 reports per minute
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, cfg: RateLimitConfig, now: number = Date.now()): RateLimitResult {
  const bucket = buckets.get(key) ?? { times: [] };
  bucket.times = bucket.times.filter((t) => now - t < cfg.windowMs);
  if (bucket.times.length >= cfg.max) {
    const retryAfterMs = cfg.windowMs - (now - bucket.times[0]);
    buckets.set(key, bucket);
    return { allowed: false, retryAfterMs };
  }
  bucket.times.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}
