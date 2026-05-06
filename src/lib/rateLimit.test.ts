import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('allows actions under the limit', () => {
    const cfg = { max: 3, windowMs: 1000 };
    expect(checkRateLimit('like:p1', cfg, 0).allowed).toBe(true);
    expect(checkRateLimit('like:p1', cfg, 100).allowed).toBe(true);
    expect(checkRateLimit('like:p1', cfg, 200).allowed).toBe(true);
  });

  it('blocks once limit is exceeded within the window', () => {
    const cfg = { max: 2, windowMs: 1000 };
    checkRateLimit('like:p1', cfg, 0);
    checkRateLimit('like:p1', cfg, 100);
    const r = checkRateLimit('like:p1', cfg, 200);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows again after the window passes', () => {
    const cfg = { max: 1, windowMs: 1000 };
    expect(checkRateLimit('like:p1', cfg, 0).allowed).toBe(true);
    expect(checkRateLimit('like:p1', cfg, 500).allowed).toBe(false);
    expect(checkRateLimit('like:p1', cfg, 1500).allowed).toBe(true);
  });

  it('isolates buckets by key', () => {
    const cfg = { max: 1, windowMs: 1000 };
    expect(checkRateLimit('a', cfg, 0).allowed).toBe(true);
    expect(checkRateLimit('b', cfg, 0).allowed).toBe(true);
  });
});
