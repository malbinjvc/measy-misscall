import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildThankYouResponse, buildErrorResponse } from "@/lib/twiml";
import { sendSms, buildBookingSmsBody, buildCallbackSmsBody } from "@/lib/sms";
import { normalizePhoneNumber } from "@/lib/utils";
import { getSharedAudioUrl } from "@/lib/elevenlabs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const digits = formData.get("Digits") as string;
    const callId = req.nextUrl.searchParams.get("callId");

    if (!callId) {
      return new NextResponse(buildErrorResponse(getSharedAudioUrl("error")), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { tenant: true },
    });

    if (!call) {
      return new NextResponse(buildErrorResponse(getSharedAudioUrl("error")), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const tenant = call.tenant;
    const fromNumber = normalizePhoneNumber(tenant.assignedTwilioNumber) || undefined;

    if (digits === "1") {
      // Callback request - send SMS with booking link
      await prisma.call.update({
        where: { id: callId },
        data: { ivrResponse: "BOOKING_LINK", ivrDigit: "1" },
      });

      const smsBody = buildBookingSmsBody(tenant.name, tenant.slug);
      await sendSms({
        tenantId: tenant.id,
        to: call.callerNumber,
        from: fromNumber,
        body: smsBody,
        type: "BOOKING_LINK",
        callId: call.id,
      });

      const twiml = buildThankYouResponse(
        "Thank you! We have sent you a text message with a link to check out our services. Goodbye!",
        getSharedAudioUrl("thankyou-booking")
      );
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    } else if (digits === "2") {
      // Callback request - record and send confirmation SMS
      await prisma.call.update({
        where: { id: callId },
        data: { ivrResponse: "CALLBACK", ivrDigit: "2" },
      });

      const smsBody = buildCallbackSmsBody(tenant.name);
      await sendSms({
        tenantId: tenant.id,
        to: call.callerNumber,
        from: fromNumber,
        body: smsBody,
        type: "CUSTOM",
        callId: call.id,
      });

      const twiml = buildThankYouResponse(
        "Thank you for requesting a callback! Our team will reach out to you as soon as possible. Goodbye!",
        getSharedAudioUrl("thankyou-callback")
      );
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    } else {
      // Invalid digit
      await prisma.call.update({
        where: { id: callId },
        data: { ivrResponse: "INVALID", ivrDigit: digits },
      });

      const twiml = buildThankYouResponse(
        "Sorry, that was not a valid option. Goodbye!",
        getSharedAudioUrl("invalid")
      );
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }
  } catch (error) {
    console.error("Twilio gather error:", error);
    return new NextResponse(buildErrorResponse(getSharedAudioUrl("error")), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
