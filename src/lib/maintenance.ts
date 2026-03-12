import prisma from "@/lib/prisma";

let cachedMode: { enabled: boolean; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

/** Check if maintenance mode is enabled (cached, 30s TTL) */
export async function isMaintenanceMode(): Promise<boolean> {
  if (cachedMode && Date.now() < cachedMode.expiresAt) {
    return cachedMode.enabled;
  }

  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "platform-settings" },
      select: { maintenanceMode: true },
    });
    const enabled = settings?.maintenanceMode ?? false;
    cachedMode = { enabled, expiresAt: Date.now() + CACHE_TTL_MS };
    return enabled;
  } catch {
    // If DB is down, don't block — assume not in maintenance
    return false;
  }
}

/** Clear the cache (call after toggling maintenance mode) */
export function clearMaintenanceCache() {
  cachedMode = null;
}
