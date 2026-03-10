import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma, SmsStatus } from "@prisma/client";
import { sanitizePagination } from "@/lib/utils";
import { getTwilioClient } from "@/lib/twilio";

/**
 * Lazy-sync: when SMS logs are viewed, refresh any QUEUED/SENT messages older than
 * 30 seconds by fetching their real status from Twilio. This handles cases where
 * Twilio's statusCallback can't reach the server (e.g. ngrok free tier interstitial).
 * Fire-and-forget — doesn't block the response.
 */
function lazySyncStaleStatuses(tenantId: string) {
  const staleThreshold = new Date(Date.now() - 30_000);

  prisma.smsLog
    .findMany({
      where: {
        tenantId,
        status: { in: ["QUEUED", "SENT"] },
        twilioMessageSid: { not: null },
        createdAt: { lt: staleThreshold },
      },
      select: { id: true, twilioMessageSid: true },
      take: 20, // bounded batch
    })
    .then(async (stale) => {
      if (stale.length === 0) return;
      const client = await getTwilioClient();

      const statusMap: Record<string, SmsStatus> = {
        queued: "QUEUED",
        sent: "SENT",
        delivered: "DELIVERED",
        failed: "FAILED",
        undelivered: "UNDELIVERED",
      };

      await Promise.allSettled(
        stale.map(async (log) => {
          const msg = await client.messages(log.twilioMessageSid!).fetch();
          const newStatus = statusMap[msg.status] || "QUEUED";
          if (newStatus !== "QUEUED" && newStatus !== "SENT") {
            await prisma.smsLog.update({
              where: { id: log.id },
              data: {
                status: newStatus,
                deliveredAt: newStatus === "DELIVERED" ? new Date() : undefined,
                errorCode: msg.errorCode?.toString() || null,
                errorMessage: msg.errorMessage || null,
              },
            });
          }
        })
      );
    })
    .catch((err) => console.error("Lazy SMS status sync error:", err));
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const { page, pageSize } = sanitizePagination(searchParams.get("page"), searchParams.get("pageSize"));
    const status = searchParams.get("status");

    const where: Prisma.SmsLogWhereInput = { tenantId: session.user.tenantId, type: { not: "OTP_VERIFICATION" } };
    if (status) where.status = status as Prisma.EnumSmsStatusFilter;

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsLog.count({ where }),
    ]);

    // Fire-and-forget: sync stale QUEUED/SENT statuses from Twilio
    lazySyncStaleStatuses(session.user.tenantId);

    return NextResponse.json({ success: true, data: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}
