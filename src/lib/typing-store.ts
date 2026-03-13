// Typing indicator store — Redis-backed for multi-instance consistency
// Falls back to in-memory when REDIS_URL is not configured (dev mode)

import { redis } from "./redis";

const TYPING_TTL = 5; // 5 seconds (Redis uses seconds)
const KEY_PREFIX = "typing:";

// In-memory fallback for development (no Redis)
interface TypingEntry {
  name: string;
  expiresAt: number;
}
const memoryFallback = new Map<string, TypingEntry>();

export async function setTyping(ticketId: string, role: string, name: string) {
  const key = `${KEY_PREFIX}${ticketId}:${role}`;

  if (redis) {
    await redis.set(key, name, "EX", TYPING_TTL);
  } else {
    memoryFallback.set(key, { name, expiresAt: Date.now() + TYPING_TTL * 1000 });
  }
}

export async function getTyping(ticketId: string, forRole: string): Promise<{ name: string } | null> {
  // Return the OTHER party's typing status
  const otherRole = forRole === "ADMIN" ? "TENANT" : "ADMIN";
  const key = `${KEY_PREFIX}${ticketId}:${otherRole}`;

  if (redis) {
    const name = await redis.get(key);
    return name ? { name } : null;
  }

  // In-memory fallback
  const entry = memoryFallback.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) memoryFallback.delete(key);
    return null;
  }
  return { name: entry.name };
}
