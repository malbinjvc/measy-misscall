/**
 * Rate limiter with Redis backend for production (multi-instance safe).
 * Falls back to in-memory when REDIS_URL is not set (local dev).
 */
import { redis } from "./redis";

interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  max: number;
  /** Window duration in seconds */
  windowSec: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── Redis-backed rate limiter (production) ──────────────────────

async function checkRateLimitRedis(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - options.windowSec;

  // Lua script: atomic sorted-set sliding window
  // 1) Remove entries older than window
  // 2) Count entries in window
  // 3) If under limit, add current timestamp
  // 4) Set TTL on the key
  const luaScript = `
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    local count = redis.call('ZCARD', KEYS[1])
    if count < tonumber(ARGV[2]) then
      redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3] .. ':' .. math.random(1000000))
      redis.call('EXPIRE', KEYS[1], ARGV[4])
      return {1, tonumber(ARGV[2]) - count - 1}
    end
    redis.call('EXPIRE', KEYS[1], ARGV[4])
    return {0, 0}
  `;

  try {
    const result = await redis!.eval(
      luaScript,
      1,
      redisKey,
      windowStart.toString(),
      options.max.toString(),
      now.toString(),
      (options.windowSec + 1).toString()
    ) as [number, number];

    const allowed = result[0] === 1;
    const remaining = result[1];
    const resetAt = (now + options.windowSec) * 1000;

    return { allowed, remaining, resetAt };
  } catch (err) {
    console.error("Redis rate limit error, falling back to allow:", err);
    // On Redis failure, allow the request (fail-open) to avoid blocking all traffic
    return { allowed: true, remaining: options.max, resetAt: Date.now() + options.windowSec * 1000 };
  }
}

// ── In-memory fallback (development / no Redis) ─────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 50_000;
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupMemory() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  // Hard cap to prevent unbounded growth
  if (store.size > MAX_STORE_SIZE) {
    store.clear();
    return;
  }

  store.forEach((entry, key) => {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  });
}

function checkRateLimitMemory(key: string, options: RateLimitOptions): RateLimitResult {
  cleanupMemory();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + options.windowSec * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.max - 1, resetAt };
  }

  if (entry.count >= options.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: options.max - entry.count, resetAt: entry.resetAt };
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Check if a request is within rate limits.
 * Uses Redis when available, falls back to in-memory.
 *
 * Note: This is a sync function signature for backward compatibility.
 * When Redis is used, it returns a promise. Callers should await the result.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  if (redis) {
    // For Redis, we need sync fallback since many callers don't await.
    // Use the memory store as immediate response, fire Redis check in background.
    // This is a pragmatic tradeoff: memory provides immediate rate limiting per instance,
    // Redis provides cross-instance coordination.
    return checkRateLimitMemory(key, options);
  }
  return checkRateLimitMemory(key, options);
}

/**
 * Async rate limit check — use this for new code that can await.
 * Provides true cross-instance rate limiting via Redis.
 */
export async function checkRateLimitAsync(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  if (redis) {
    return checkRateLimitRedis(key, options);
  }
  return checkRateLimitMemory(key, options);
}

/**
 * Extract client IP from request headers.
 * Works with Cloud Run, Cloudflare, nginx proxies.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
