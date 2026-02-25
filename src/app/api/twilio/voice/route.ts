import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildDialResponse, buildErrorResponse } from "@/lib/twiml";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;
    const callSid = formData.get("CallSid") as string;

    // Find tenant by Twilio phone number
    let tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { twilioPhoneNumber: to },
          { useSharedTwilio: true },
        ],
        status: "ACTIVE",
      },
    });

    // If using shared Twilio, try to match by the To number from platform settings
    if (!tenant) {
      return new NextResponse(buildErrorResponse(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Create call record
    await prisma.call.create({
      data: {
        tenantId: tenant.id,
        twilioCallSid: callSid,
        callerNumber: from,
        status: "NO_ANSWER",
      },
    });

    if (!tenant.forwardingNumber) {
      return new NextResponse(buildErrorResponse(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Forward call to business owner
    const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/status`;
    const twiml = buildDialResponse(
      tenant.forwardingNumber,
      statusCallbackUrl,
      tenant.dialTimeout
    );

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Twilio voice error:", error);
    return new NextResponse(buildErrorResponse(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
