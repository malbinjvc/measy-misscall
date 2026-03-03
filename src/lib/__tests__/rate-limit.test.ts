import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset the module-level store between tests by re-importing
    // Since we can't clear the Map directly, we use unique keys per test
    vi.restoreAllMocks();
  });

  it('first request is allowed', () => {
    const result = checkRateLimit('test-first-request', { max: 5, windowSec: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('requests up to max are allowed', () => {
    const key = 'test-up-to-max';
    const options = { max: 3, windowSec: 60 };

    const r1 = checkRateLimit(key, options);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, options);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, options);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('request over max is denied', () => {
    const key = 'test-over-max';
    const options = { max: 2, windowSec: 60 };

    checkRateLimit(key, options);
    checkRateLimit(key, options);

    const r3 = checkRateLimit(key, options);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('window reset after expiry allows new requests', () => {
    const key = 'test-window-reset';
    const options = { max: 1, windowSec: 1 };

    const r1 = checkRateLimit(key, options);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit(key, options);
    expect(r2.allowed).toBe(false);

    // Advance time past the window
    vi.useFakeTimers();
    vi.advanceTimersByTime(2000);

    const r3 = checkRateLimit(key, options);
    expect(r3.allowed).toBe(true);

    vi.useRealTimers();
  });

  it('different keys are independent', () => {
    const options = { max: 1, windowSec: 60 };

    const r1 = checkRateLimit('key-a-independent', options);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit('key-b-independent', options);
    expect(r2.allowed).toBe(true);

    // key-a should be exhausted
    const r3 = checkRateLimit('key-a-independent', options);
    expect(r3.allowed).toBe(false);

    // key-b should also be exhausted independently
    const r4 = checkRateLimit('key-b-independent', options);
    expect(r4.allowed).toBe(false);
  });
});

describe('getClientIp', () => {
  it('returns x-forwarded-for first IP', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '9.9.9.9',
      },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('returns x-real-ip if no x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-real-ip': '10.0.0.1',
      },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('returns "unknown" if no headers', () => {
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('unknown');
  });
});
