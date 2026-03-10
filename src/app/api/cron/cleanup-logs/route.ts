import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Cron job: Delete old AdminLog records to prevent unbounded table growth.
 * Retains 90 days of logs. Runs daily. Uses raw SQL LIMIT for true batching.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  let totalDeleted = 0;
  const BATCH_SIZE = 1000;
  const MAX_BATCHES = 10;

  for (let i = 0; i < MAX_BATCHES; i++) {
    const result = await prisma.$executeRaw`
      DELETE FROM "AdminLog"
      WHERE id IN (
        SELECT id FROM "AdminLog"
        WHERE "createdAt" < ${cutoff}
        LIMIT ${BATCH_SIZE}
      )
    `;

    totalDeleted += result;
    if (result < BATCH_SIZE) break;
  }

  console.log(`Cleanup logs cron: deleted ${totalDeleted} admin log records older than 90 days`);
  return NextResponse.json({ success: true, deleted: totalDeleted });
}
