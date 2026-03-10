import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildThankYouResponse, buildErrorResponse } from "@/lib/twiml";
import { sendSms, buildBookingSmsBody, buildCallbackSmsBody } from "@/lib/sms";
import { normalizePhoneNumber } from "@/lib/utils";
import { getSharedAudioUrl } from "@/lib/elevenlabs";
import { validateTwilioSignature } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    // Parse form data once — reuse for verification and data extraction
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => { params[key] = value.toString(); });

    const signature = req.headers.get("x-twilio-signature");
    if (!signature) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const internalUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || internalUrl.origin;
    const url = baseUrl + internalUrl.pathname + internalUrl.search;

    const isValid = await validateTwilioSignature(signature, url, params);
    if (!isValid) {
      console.warn("Invalid Twilio signature on /api/twilio/gather");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const digits = params.Digits;
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
