import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// Cache in ALL environments (including production on Cloud Run)
// to prevent creating multiple PrismaClient instances per import.
// Connection pool size: set via DATABASE_URL ?connection_limit=5
globalForPrisma.prisma = prisma;

export default prisma;
