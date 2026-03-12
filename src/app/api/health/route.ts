import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

/**
 * Health check endpoint for Cloud Run.
 * Returns 200 if the app is running and can reach the database.
 * Used by: Cloud Run liveness/startup probes, load balancer health checks.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error" | "skipped"> = {
    app: "ok",
    database: "skipped",
    redis: "skipped",
  };

  // Database connectivity check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Redis connectivity check (optional — may not be configured)
  if (redis) {
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }
  }

  const healthy = checks.database === "ok";

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
