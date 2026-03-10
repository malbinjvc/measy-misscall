import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Cron job: Delete expired PhoneVerification records to prevent unbounded table growth.
 * Runs daily. Uses raw SQL with LIMIT for true batching (Prisma deleteMany has no LIMIT).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let totalDeleted = 0;
  const BATCH_SIZE = 1000;
  const MAX_BATCHES = 10; // Safety cap: max 10,000 rows per invocation

  for (let i = 0; i < MAX_BATCHES; i++) {
    const result = await prisma.$executeRaw`
      DELETE FROM "PhoneVerification"
      WHERE id IN (
        SELECT id FROM "PhoneVerification"
        WHERE "expiresAt" < NOW()
        LIMIT ${BATCH_SIZE}
      )
    `;

    totalDeleted += result;

    // If we deleted fewer than batch size, no more rows to clean up
    if (result < BATCH_SIZE) break;
  }

  console.log(`Cleanup verifications cron: deleted ${totalDeleted} expired records`);
  return NextResponse.json({ success: true, deleted: totalDeleted });
}
