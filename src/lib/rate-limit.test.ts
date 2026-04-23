import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getClientKey, rateLimit } from '@/src/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const opts = { limit: 3, windowMs: 60_000 };

  it('allows the first request and reports remaining = limit - 1', () => {
    const result = rateLimit('new-key-1', opts);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetAt).toBe(Date.now() + 60_000);
  });

  it('decrements remaining on each allowed hit inside the window', () => {
    const k = 'new-key-2';
    expect(rateLimit(k, opts).remaining).toBe(2);
    expect(rateLimit(k, opts).remaining).toBe(1);
    expect(rateLimit(k, opts).remaining).toBe(0);
  });

  it('blocks once the limit is hit and keeps the original resetAt', () => {
    const k = 'new-key-3';
    rateLimit(k, opts);
    rateLimit(k, opts);
    const third = rateLimit(k, opts);
    const fourth = rateLimit(k, opts);

    expect(third.success).toBe(true);
    expect(fourth.success).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.resetAt).toBe(third.resetAt);
  });

  it('rolls the window when time advances past resetAt', () => {
    const k = 'new-key-4';
    rateLimit(k, opts);
    rateLimit(k, opts);
    rateLimit(k, opts);
    expect(rateLimit(k, opts).success).toBe(false);

    vi.advanceTimersByTime(60_001);

    const rolled = rateLimit(k, opts);
    expect(rolled.success).toBe(true);
    expect(rolled.remaining).toBe(2);
    expect(rolled.resetAt).toBe(Date.now() + 60_000);
  });

  it('does not roll the window one millisecond before resetAt', () => {
    const k = 'new-key-5';
    rateLimit(k, opts);
    rateLimit(k, opts);
    rateLimit(k, opts);
    vi.advanceTimersByTime(59_999);
    expect(rateLimit(k, opts).success).toBe(false);
  });

  it('isolates buckets by key', () => {
    const a = rateLimit('iso-a', opts);
    const b = rateLimit('iso-b', opts);
    expect(a.remaining).toBe(2);
    expect(b.remaining).toBe(2);
  });

  it('treats resetAt == now as an expired bucket (fresh window)', () => {
    const k = 'exactly-now';
    rateLimit(k, opts);
    rateLimit(k, opts);
    rateLimit(k, opts);
    vi.advanceTimersByTime(60_000);
    const rolled = rateLimit(k, opts);
    expect(rolled.success).toBe(true);
    expect(rolled.remaining).toBe(2);
  });
});

describe('getClientKey', () => {
  it('prefers userId when present', () => {
    const req = new Request('http://localhost/x', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(getClientKey(req, 'user-123')).toBe('user:user-123');
  });

  it('falls back to the first x-forwarded-for IP', () => {
    const req = new Request('http://localhost/x', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientKey(req, null)).toBe('ip:1.2.3.4');
  });

  it('trims spaces inside x-forwarded-for', () => {
    const req = new Request('http://localhost/x', {
      headers: { 'x-forwarded-for': '   9.9.9.9   , 1.1.1.1' },
    });
    expect(getClientKey(req)).toBe('ip:9.9.9.9');
  });

  it('falls back to x-real-ip when no x-forwarded-for', () => {
    const req = new Request('http://localhost/x', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientKey(req)).toBe('ip:10.0.0.1');
  });

  it('returns ip:unknown when no IP headers are present', () => {
    const req = new Request('http://localhost/x');
    expect(getClientKey(req)).toBe('ip:unknown');
  });
});
