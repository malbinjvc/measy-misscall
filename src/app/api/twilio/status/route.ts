import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildIvrResponse, buildErrorResponse } from "@/lib/twiml";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const dialCallStatus = formData.get("DialCallStatus") as string;

    // Find the call record
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: callSid },
      include: { tenant: true },
    });

    if (!call) {
      return new NextResponse(buildErrorResponse(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // If the call was answered, update and hang up
    if (dialCallStatus === "completed") {
      await prisma.call.update({
        where: { id: call.id },
        data: { status: "ANSWERED" },
      });

      const twilio = await import("twilio");
      const VoiceResponse = twilio.default.twiml.VoiceResponse;
      const response = new VoiceResponse();
      response.hangup();
      return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Call was not answered - update status and play IVR
    const statusMap: Record<string, string> = {
      "no-answer": "NO_ANSWER",
      busy: "BUSY",
      failed: "FAILED",
      canceled: "MISSED",
    };

    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: (statusMap[dialCallStatus] || "MISSED") as any,
      },
    });

    // Play IVR
    const gatherUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/gather?callId=${call.id}`;
    const twiml = buildIvrResponse(
      gatherUrl,
      call.tenant.ivrGreeting || "Thank you for calling. We missed your call.",
      call.tenant.ivrCallbackMessage || "Press 1 if you would like us to call you back.",
      call.tenant.ivrComplaintMessage || "Press 2 to submit a complaint or feedback."
    );

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Twilio status error:", error);
    return new NextResponse(buildErrorResponse(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
