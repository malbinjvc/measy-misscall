import { SmsType } from "@prisma/client";
import prisma from "./prisma";
import { getTwilioClient } from "./twilio";
import { getBaseUrl, getShopUrl, normalizePhoneForStorage } from "./utils";

const OPT_OUT_NOTICE = "\nReply STOP to opt out.";

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SMS send failed";
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
        errorMessage: message,
      },
    });

    return { success: false, error: message };
  }
}

export function buildBookingSmsBody(businessName: string, slug: string): string {
  const url = getShopUrl(slug);
  return `Hi from ${businessName}! We're sorry we missed your call. Check out our services and book an appointment here: ${url}${OPT_OUT_NOTICE}`;
}

export function buildCallbackSmsBody(businessName: string): string {
  return `Hi from ${businessName}! We received your callback request. Our team will get back to you shortly. Thank you for your patience!${OPT_OUT_NOTICE}`;
}

export function buildConfirmationSmsBody(
  businessName: string,
  slug: string,
  date: string,
  startTime: string
): string {
  const accountUrl = `${getBaseUrl()}/shop/${slug}/account`;
  return `Hi from ${businessName}! Your appointment on ${date} at ${startTime} is confirmed. View details: ${accountUrl}${OPT_OUT_NOTICE}`;
}

export function buildReminderSmsBody(
  businessName: string,
  slug: string,
  date: string,
  startTime: string
): string {
  const accountUrl = `${getBaseUrl()}/shop/${slug}/account`;
  return `Reminder from ${businessName}: You have an appointment tomorrow at ${startTime}. View details: ${accountUrl}${OPT_OUT_NOTICE}`;
}

/**
 * Send an SMS only if the customer has opted in (smsConsent === true).
 * Looks up the Customer by tenantId + phone (last-10-digit matching).
 */
export async function sendSmsWithConsent(params: SendSmsParams): Promise<{ success: boolean; error?: string; messageSid?: string }> {
  const normalizedPhone = normalizePhoneForStorage(params.to);
  const last10 = normalizedPhone.slice(-10);

  // Find customer by tenantId and phone (last 10 digits)
  const customer = await prisma.customer.findFirst({
    where: {
      tenantId: params.tenantId,
      phone: { endsWith: last10 },
    },
    select: { smsConsent: true },
  });

  if (customer && customer.smsConsent === false) {
    return { success: false, error: "No SMS consent" };
  }

  // If no customer found, or customer has consent, proceed with sending
  return sendSms(params);
}
