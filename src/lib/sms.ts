import { SmsType } from "@prisma/client";
import prisma from "./prisma";
import { getTwilioClient } from "./twilio";
import { getShopUrl } from "./utils";

interface SendSmsParams {
  tenantId: string;
  to: string;
  from?: string;
  body: string;
  type: SmsType;
  callId?: string;
}

export async function sendSms({
  tenantId,
  to,
  from,
  body,
  type,
  callId,
}: SendSmsParams) {
  const client = await getTwilioClient();
  const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;

  if (!fromNumber) {
    throw new Error("No from phone number configured");
  }

  try {
    const message = await client.messages.create({
      body,
      to,
      from: fromNumber,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/sms-status`,
    });

    // Log the SMS
    const smsLog = await prisma.smsLog.create({
      data: {
        tenantId,
        callId: callId || null,
        twilioMessageSid: message.sid,
        toNumber: to,
        fromNumber: fromNumber,
        body,
        type,
        status: "QUEUED",
      },
    });

    return { success: true, messageSid: message.sid, smsLogId: smsLog.id };
  } catch (error: any) {
    // Log failed SMS
    await prisma.smsLog.create({
      data: {
        tenantId,
        callId: callId || null,
        toNumber: to,
        fromNumber: fromNumber,
        body,
        type,
        status: "FAILED",
        errorMessage: error.message,
      },
    });

    return { success: false, error: error.message };
  }
}

export function buildBookingSmsBody(businessName: string, slug: string): string {
  const url = getShopUrl(slug);
  return `Hi from ${businessName}! We're sorry we missed your call. Check out our services and book an appointment here: ${url}`;
}

export function buildCallbackSmsBody(businessName: string): string {
  return `Hi from ${businessName}! We received your callback request. Our team will get back to you shortly. Thank you for your patience!`;
}
