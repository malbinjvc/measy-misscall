import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildThankYouResponse, buildErrorResponse } from "@/lib/twiml";
import { sendSms, buildBookingSmsBody, buildComplaintSmsBody } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const digits = formData.get("Digits") as string;
    const callId = req.nextUrl.searchParams.get("callId");

    if (!callId) {
      return new NextResponse(buildErrorResponse(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { tenant: true },
    });

    if (!call) {
      return new NextResponse(buildErrorResponse(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const tenant = call.tenant;
    const fromNumber = tenant.useSharedTwilio
      ? process.env.TWILIO_PHONE_NUMBER
      : tenant.twilioPhoneNumber;

    if (digits === "1") {
      // Callback request - send SMS with booking link
      await prisma.call.update({
        where: { id: callId },
        data: { ivrResponse: "CALLBACK", ivrDigit: "1" },
      });

      const smsBody = buildBookingSmsBody(tenant.name, tenant.slug);
      await sendSms({
        tenantId: tenant.id,
        to: call.callerNumber,
        from: fromNumber || undefined,
        body: smsBody,
        type: "BOOKING_LINK",
        callId: call.id,
        accountSid: tenant.useSharedTwilio ? null : tenant.twilioAccountSid,
        authToken: tenant.useSharedTwilio ? null : tenant.twilioAuthToken,
      });

      const twiml = buildThankYouResponse(
        "Thank you! We have sent you a text message with a link to book an appointment. Goodbye!"
      );
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    } else if (digits === "2") {
      // Complaint - send SMS with complaint form link
      await prisma.call.update({
        where: { id: callId },
        data: { ivrResponse: "COMPLAINT", ivrDigit: "2" },
      });

      const smsBody = buildComplaintSmsBody(tenant.name, tenant.slug, call.id);
      await sendSms({
        tenantId: tenant.id,
        to: call.callerNumber,
        from: fromNumber || undefined,
        body: smsBody,
        type: "COMPLAINT_LINK",
        callId: call.id,
        accountSid: tenant.useSharedTwilio ? null : tenant.twilioAccountSid,
        authToken: tenant.useSharedTwilio ? null : tenant.twilioAuthToken,
      });

      const twiml = buildThankYouResponse(
        "Thank you! We have sent you a text message with a link to submit your feedback. Goodbye!"
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
        "Sorry, that was not a valid option. Goodbye!"
      );
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }
  } catch (error) {
    console.error("Twilio gather error:", error);
    return new NextResponse(buildErrorResponse(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
