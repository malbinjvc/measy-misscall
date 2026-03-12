/**
 * Redis client for shared state across Cloud Run instances.
 * Used for: rate limiting, typing indicators, short-lived caches.
 *
 * Env: REDIS_URL (e.g. redis://10.0.0.1:6379 for Cloud Memorystore,
 *       or rediss://...@...upstash.io:6379 for Upstash)
 */
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | null;
};

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  return new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });
}

export const redis: Redis | null =
  globalForRedis.redis ?? createRedisClient();

if (redis) {
  globalForRedis.redis = redis;
}
