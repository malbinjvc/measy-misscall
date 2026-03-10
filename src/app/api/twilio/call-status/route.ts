import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/twilio";
import { chargeForUsage } from "@/lib/wallet";

/**
 * Twilio call status callback — receives call completion events with duration.
 * Used to record call duration and charge wallet per minute.
 */
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
      console.warn("Invalid Twilio signature on /api/twilio/call-status");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const callSid = params.CallSid;
    const callStatus = params.CallStatus;
    const callDuration = params.CallDuration; // in seconds

    if (!callSid) {
      return new NextResponse("OK", { status: 200 });
    }

    // Find the call record
    const call = await prisma.call.findUnique({
      where: { twilioCallSid: callSid },
    });

    if (!call) {
      console.warn(`Call status callback: no call found for SID ${callSid}`);
      return new NextResponse("OK", { status: 200 });
    }

    // Update call with duration
    const durationSeconds = parseInt(callDuration || "0", 10);
    await prisma.call.update({
      where: { id: call.id },
      data: {
        duration: durationSeconds,
      },
    });

    // Only charge when the call is completed
    if (callStatus === "completed" && durationSeconds > 0) {
      // Round up to the nearest minute
      const minutes = Math.ceil(durationSeconds / 60);

      // Charge wallet for actual call minutes (fire-and-forget)
      chargeForUsage(call.tenantId, "call", minutes).catch((err) =>
        console.error("Call wallet charge failed:", err)
      );
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Call status callback error:", error);
    return new NextResponse("OK", { status: 200 });
  }
}
