import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { releaseTwilioNumber } from "@/lib/twilio-cleanup";
import { logAdminAction } from "@/lib/admin-log";

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pendingItems = await prisma.twilioCleanupQueue.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: "asc" },
    take: 10, // Process in batches to stay within function timeout
  });

  if (pendingItems.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  let completed = 0;
  let failed = 0;
  let abandoned = 0;

  for (const item of pendingItems) {
    const newAttempts = item.attempts + 1;
    const released = await releaseTwilioNumber(item.phoneNumber);

    if (released) {
      await prisma.twilioCleanupQueue.update({
        where: { id: item.id },
        data: { status: "COMPLETED", attempts: newAttempts },
      });
      await logAdminAction({
        action: "TWILIO_NUMBER_RELEASED",
        details: `Released Twilio number ${item.phoneNumber} (retry attempt ${newAttempts}) — originally from "${item.tenantName ?? "unknown"}" (${item.reason})`,
        tenantId: item.tenantId ?? undefined,
        tenantName: item.tenantName ?? undefined,
        status: "SUCCESS",
        metadata: { phoneNumber: item.phoneNumber, reason: item.reason, attempt: newAttempts },
      });
      completed++;
    } else if (newAttempts >= item.maxAttempts) {
      await prisma.twilioCleanupQueue.update({
        where: { id: item.id },
        data: {
          status: "ABANDONED",
          attempts: newAttempts,
          lastError: "Max retry attempts reached",
        },
      });
      await logAdminAction({
        action: "TWILIO_NUMBER_RELEASED",
        details: `Abandoned Twilio number release for ${item.phoneNumber} after ${newAttempts} attempts — manual cleanup required`,
        tenantId: item.tenantId ?? undefined,
        tenantName: item.tenantName ?? undefined,
        status: "FAILED",
        metadata: { phoneNumber: item.phoneNumber, reason: item.reason, attempt: newAttempts, abandoned: true },
      });
      abandoned++;
    } else {
      const nextRetryAt = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.twilioCleanupQueue.update({
        where: { id: item.id },
        data: {
          attempts: newAttempts,
          lastError: "Release attempt failed",
          nextRetryAt,
        },
      });
      failed++;
    }
  }

  console.log(`Twilio cleanup cron: ${completed} completed, ${failed} retrying, ${abandoned} abandoned`);
  return NextResponse.json({ success: true, processed: pendingItems.length, completed, failed, abandoned });
}
