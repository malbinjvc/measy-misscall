import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTwilioClient } from "@/lib/twilio";
import { getBaseUrl } from "@/lib/utils";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const baseUrl = getBaseUrl();
    const voiceUrl = `${baseUrl}/api/twilio/voice`;
    const smsUrl = `${baseUrl}/api/twilio/sms-status`;
    const callStatusUrl = `${baseUrl}/api/twilio/call-status`;

    // Find all tenants with assigned Twilio numbers
    const tenants = await prisma.tenant.findMany({
      where: { assignedTwilioNumber: { not: null } },
      select: { id: true, name: true, assignedTwilioNumber: true },
    });

    if (tenants.length === 0) {
      return NextResponse.json({ success: true, data: { updated: 0, message: "No Twilio numbers to sync" } });
    }

    const client = await getTwilioClient();

    // Process in parallel batches of 10 to avoid Twilio rate limits
    const BATCH_SIZE = 10;
    const results: Array<{ tenant: string; number: string; status: string }> = [];

    for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
      const batch = tenants.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (tenant) => {
          try {
            const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: tenant.assignedTwilioNumber! });
            if (numbers.length === 0) {
              return { tenant: tenant.name, number: tenant.assignedTwilioNumber!, status: "not_found_in_twilio" };
            }

            const numberSid = numbers[0].sid;
            const currentVoiceUrl = numbers[0].voiceUrl;

            if (currentVoiceUrl === voiceUrl) {
              return { tenant: tenant.name, number: tenant.assignedTwilioNumber!, status: "already_synced" };
            }

            await client.incomingPhoneNumbers(numberSid).update({
              voiceUrl,
              voiceMethod: "POST",
              statusCallback: callStatusUrl,
              statusCallbackMethod: "POST",
              smsUrl,
              smsMethod: "POST",
            });

            return { tenant: tenant.name, number: tenant.assignedTwilioNumber!, status: "updated" };
          } catch (err) {
            console.error(`Failed to sync webhook for ${tenant.name}:`, err);
            return { tenant: tenant.name, number: tenant.assignedTwilioNumber!, status: "error" };
          }
        })
      );

      for (const result of batchResults) {
        results.push(result.status === "fulfilled" ? result.value : { tenant: "unknown", number: "unknown", status: "error" });
      }
    }

    const updated = results.filter((r) => r.status === "updated").length;
    return NextResponse.json({
      success: true,
      data: { updated, total: tenants.length, baseUrl: voiceUrl, results },
    });
  } catch (error) {
    console.error("Webhook sync failed:", error);
    return NextResponse.json({ success: false, error: "Failed to sync webhooks" }, { status: 500 });
  }
}
