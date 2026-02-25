import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string | null;

    if (!messageSid) {
      return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      queued: "QUEUED",
      sent: "SENT",
      delivered: "DELIVERED",
      failed: "FAILED",
      undelivered: "UNDELIVERED",
    };

    const status = statusMap[messageStatus] || "QUEUED";

    await prisma.smsLog.updateMany({
      where: { twilioMessageSid: messageSid },
      data: {
        status: status as any,
        errorCode: errorCode || null,
        deliveredAt: status === "DELIVERED" ? new Date() : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SMS status error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
