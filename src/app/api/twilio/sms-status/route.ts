import { NextRequest, NextResponse } from "next/server";
import { SmsStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    // Parse form data ONCE — reuse for both signature verification and data extraction.
    // Cloning + re-reading can fail in Node.js due to body stream locking.
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Validate Twilio webhook signature
    const signature = req.headers.get("x-twilio-signature");
    if (!signature) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const internalUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || internalUrl.origin;
    const url = baseUrl + internalUrl.pathname + internalUrl.search;

    const isValid = await validateTwilioSignature(signature, url, params);
    if (!isValid) {
      console.warn("Invalid Twilio signature on /api/twilio/sms-status");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageSid = params.MessageSid;
    const messageStatus = params.MessageStatus;
    const errorCode = params.ErrorCode || null;

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
        errorCode,
        deliveredAt: status === "DELIVERED" ? new Date() : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SMS status error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
