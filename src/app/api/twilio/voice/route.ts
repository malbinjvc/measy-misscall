import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildIvrResponse, buildErrorResponse } from "@/lib/twiml";
import { normalizePhoneNumber } from "@/lib/utils";
import { getSharedAudioUrl } from "@/lib/elevenlabs";
import { validateTwilioSignature } from "@/lib/twilio";
import { hasFeature } from "@/lib/feature-gate";

export async function POST(req: NextRequest) {
  try {
    // Parse form data once — reuse for verification and data extraction
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => { params[key] = value.toString(); });

    const signature = req.headers.get("x-twilio-signature");
    if (!signature) return new NextResponse("Forbidden", { status: 403 });

    const internalUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || internalUrl.origin;
    const url = baseUrl + internalUrl.pathname + internalUrl.search;

    const isValid = await validateTwilioSignature(signature, url, params);
    if (!isValid) {
      console.warn("Invalid Twilio signature on /api/twilio/voice");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const to = normalizePhoneNumber(params.To);
    const from = params.From;
    const callSid = params.CallSid;

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
      console.error(`No active tenant found for Twilio number: ${to} (raw: ${params.To})`);
      return new NextResponse(buildErrorResponse(getSharedAudioUrl("error")), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Check if tenant's plan includes missed call IVR
    const ivrEnabled = await hasFeature(tenant.id, "missed_call_ivr");

    // Create call record as MISSED (call arrived via carrier forwarding)
    const call = await prisma.call.create({
      data: {
        tenantId: tenant.id,
        twilioCallSid: callSid,
        callerNumber: from,
        status: "MISSED",
      },
    });

    // If IVR not enabled on plan, still record the call but don't play IVR
    if (!ivrEnabled) {
      return new NextResponse(buildErrorResponse(getSharedAudioUrl("error")), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Play IVR directly — no Dial step needed
    // Call charges are handled in /api/twilio/call-status based on actual duration
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
