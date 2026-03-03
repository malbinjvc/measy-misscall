import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildIvrResponse, buildErrorResponse } from "@/lib/twiml";
import { normalizePhoneNumber } from "@/lib/utils";
import { getSharedAudioUrl } from "@/lib/elevenlabs";
import { verifyTwilioWebhook } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    // Validate Twilio webhook signature
    const isValid = await verifyTwilioWebhook(req);
    if (!isValid) {
      console.warn("Invalid Twilio signature on /api/twilio/voice");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const formData = await req.formData();
    const to = normalizePhoneNumber(formData.get("To") as string);
    const from = formData.get("From") as string;
    const callSid = formData.get("CallSid") as string;

    // Find tenant by assigned Twilio number (normalized E.164)
    const tenant = to
      ? await prisma.tenant.findFirst({
          where: {
            assignedTwilioNumber: to,
            status: "ACTIVE",
          },
        })
      : null;

    if (!tenant) {
      console.error(`No active tenant found for Twilio number: ${to} (raw: ${formData.get("To")})`);
      return new NextResponse(buildErrorResponse(getSharedAudioUrl("error")), {
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
      tenant.name,
      tenant.ivrAudioUrl,
      getSharedAudioUrl("noinput")
    );

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Twilio voice error:", error);
    return new NextResponse(buildErrorResponse(getSharedAudioUrl("error")), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
