import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { buildCampaignSmsBody } from "@/lib/sms";

const BATCH_SIZE = 25;
const MAX_RECIPIENTS = 250;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user.tenantId;

    // Find campaign in DRAFT status
    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId, status: "DRAFT" },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found or already sent" },
        { status: 404 }
      );
    }

    // Get tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, assignedTwilioNumber: true },
    });

    if (!tenant?.assignedTwilioNumber) {
      return NextResponse.json(
        { success: false, error: "No Twilio number assigned. Set up your phone number in Settings first." },
        { status: 400 }
      );
    }

    // Fetch all PENDING recipients
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: id, status: "PENDING" },
    });

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "No eligible recipients for this campaign" },
        { status: 400 }
      );
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { success: false, error: `Campaign exceeds ${MAX_RECIPIENTS} recipients. Please create smaller campaigns.` },
        { status: 400 }
      );
    }

    // Mark as SENDING
    await prisma.campaign.update({
      where: { id },
      data: { status: "SENDING", sentAt: new Date() },
    });

    // Build the SMS body
    const smsBody = buildCampaignSmsBody(tenant.name, tenant.slug, campaign.message);

    // Process in batches
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (recipient) => {
          try {
            const phone = recipient.phone.startsWith("+")
              ? recipient.phone
              : `+1${recipient.phone}`;

            const result = await sendSms({
              tenantId,
              to: phone,
              from: tenant.assignedTwilioNumber!,
              body: smsBody,
              type: "CAMPAIGN",
            });

            if (result.success) {
              await Promise.all([
                prisma.campaignRecipient.update({
                  where: { id: recipient.id },
                  data: { status: "SENT", smsLogId: result.smsLogId, sentAt: new Date() },
                }),
                prisma.campaign.update({
                  where: { id },
                  data: { sentCount: { increment: 1 } },
                }),
              ]);
            } else {
              await Promise.all([
                prisma.campaignRecipient.update({
                  where: { id: recipient.id },
                  data: { status: "FAILED", errorMessage: result.error },
                }),
                prisma.campaign.update({
                  where: { id },
                  data: { failedCount: { increment: 1 } },
                }),
              ]);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            await Promise.all([
              prisma.campaignRecipient.update({
                where: { id: recipient.id },
                data: { status: "FAILED", errorMessage: errorMsg },
              }),
              prisma.campaign.update({
                where: { id },
                data: { failedCount: { increment: 1 } },
              }),
            ]);
          }
        })
      );
    }

    // Mark complete
    await prisma.campaign.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Campaign send error:", error);
    return NextResponse.json({ success: false, error: "Failed to send campaign" }, { status: 500 });
  }
}
