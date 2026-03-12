import { PrismaClient } from "@prisma/client";
import prisma from "./prisma";

/**
 * Read-replica Prisma client.
 * Uses DATABASE_READ_REPLICA_URL when available for read-heavy queries
 * (stats, listings, reports), falling back to the primary connection.
 *
 * Usage: import prismaRead from "@/lib/prisma-read";
 *        const data = await prismaRead.smsLog.findMany({ ... });
 */

const globalForPrismaRead = globalThis as unknown as {
  prismaRead: PrismaClient | undefined;
};

const readUrl = process.env.DATABASE_READ_REPLICA_URL;

export const prismaRead: PrismaClient = readUrl
  ? (globalForPrismaRead.prismaRead ??
    new PrismaClient({
      datasources: { db: { url: readUrl } },
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    }))
  : prisma; // fallback to primary when no replica configured

// Cache in ALL environments to prevent multiple PrismaClient instances
if (readUrl) {
  globalForPrismaRead.prismaRead = prismaRead;
}

export default prismaRead;
