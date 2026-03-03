import { NextRequest, NextResponse } from "next/server";
import { SmsStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyTwilioWebhook } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    // Validate Twilio webhook signature
    const isValid = await verifyTwilioWebhook(req);
    if (!isValid) {
      console.warn("Invalid Twilio signature on /api/twilio/sms-status");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string | null;

    if (!messageSid) {
      return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
    }

    const statusMap: Record<string, SmsStatus> = {
      queued: "QUEUED",
      sent: "SENT",
      delivered: "DELIVERED",
      failed: "FAILED",
      undelivered: "UNDELIVERED",
    };

    const status: SmsStatus = statusMap[messageStatus] || "QUEUED";

    await prisma.smsLog.updateMany({
      where: { twilioMessageSid: messageSid },
      data: {
        status,
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
