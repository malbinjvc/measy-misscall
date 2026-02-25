import { SmsType } from "@prisma/client";
import prisma from "./prisma";
import { getTwilioClient } from "./twilio";
import { getBookingUrl, getComplaintUrl } from "./utils";

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
  const client = getTwilioClient();
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
  const url = getBookingUrl(slug);
  return `Hi! You called ${businessName} and we missed your call. Book an appointment online: ${url}`;
}

export function buildComplaintSmsBody(
  businessName: string,
  slug: string,
  callId?: string
): string {
  const url = getComplaintUrl(slug, callId);
  return `Hi! Thank you for contacting ${businessName}. Submit your feedback here: ${url}`;
}
