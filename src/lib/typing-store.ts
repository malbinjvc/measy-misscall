// In-memory typing indicator store
// Uses globalThis to persist across Next.js hot reloads (same pattern as Prisma client)

interface TypingEntry {
  role: string;
  name: string;
  expiresAt: number;
}

const globalForTyping = globalThis as unknown as {
  __typingMap: Map<string, TypingEntry>;
};

if (!globalForTyping.__typingMap) {
  globalForTyping.__typingMap = new Map();
}

const typingMap = globalForTyping.__typingMap;

const TYPING_TTL = 5000; // 5 seconds

export function setTyping(ticketId: string, role: string, name: string) {
  typingMap.set(`${ticketId}:${role}`, {
    role,
    name,
    expiresAt: Date.now() + TYPING_TTL,
  });
}

export function getTyping(ticketId: string, forRole: string): { name: string } | null {
  // Return the OTHER party's typing status
  const otherRole = forRole === "ADMIN" ? "TENANT" : "ADMIN";
  const entry = typingMap.get(`${ticketId}:${otherRole}`);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) typingMap.delete(`${ticketId}:${otherRole}`);
    return null;
  }
  return { name: entry.name };
}
