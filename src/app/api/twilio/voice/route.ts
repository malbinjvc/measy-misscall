import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildIvrResponse, buildErrorResponse } from "@/lib/twiml";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;
    const callSid = formData.get("CallSid") as string;

    // Find tenant by assigned Twilio number
    const tenant = await prisma.tenant.findFirst({
      where: {
        assignedTwilioNumber: to,
        status: "ACTIVE",
      },
    });

    if (!tenant) {
      return new NextResponse(buildErrorResponse(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Create call record as MISSED (call arrived via carrier forwarding)
    const call = await prisma.call.create({
      data: {
        tenantId: tenant.id,
        twilioCallSid: callSid,
        callerNumber: from,
        status: "MISSED",
      },
    });

    // Play IVR directly — no Dial step needed
    const gatherUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/gather?callId=${call.id}`;
    const twiml = buildIvrResponse(
      gatherUrl,
      tenant.ivrGreeting || "Thank you for calling. We missed your call.",
      tenant.ivrCallbackMessage || "Press 1 if you would like us to call you back.",
      tenant.ivrComplaintMessage || "Press 2 to submit a complaint or feedback."
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
