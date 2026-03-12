import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { buildCampaignSmsBody } from "@/lib/sms";
import { hasFeature, featureGatedResponse } from "@/lib/feature-gate";

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

    if (!(await hasFeature(tenantId, "campaigns"))) {
      return NextResponse.json(featureGatedResponse("Campaigns"), { status: 403 });
    }

    // Atomic compare-and-swap: DRAFT → SENDING prevents double-send race condition.
    // If two requests arrive simultaneously, only one will match status = DRAFT.
    const { count: claimed } = await prisma.campaign.updateMany({
      where: { id, tenantId, status: "DRAFT" },
      data: { status: "SENDING", sentAt: new Date() },
    });

    if (claimed === 0) {
      return NextResponse.json(
        { success: false, error: "Campaign not found or already sent" },
        { status: 404 }
      );
    }

    // Fetch campaign message + tenant info in parallel
    const [campaign, tenant] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id },
        select: { message: true },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true, assignedTwilioNumber: true },
      }),
    ]);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (!tenant?.assignedTwilioNumber) {
      // Revert status since we can't send
      await prisma.campaign.update({ where: { id }, data: { status: "DRAFT", sentAt: null } });
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
      await prisma.campaign.update({ where: { id }, data: { status: "DRAFT", sentAt: null } });
      return NextResponse.json(
        { success: false, error: "No eligible recipients for this campaign" },
        { status: 400 }
      );
    }

    if (recipients.length > MAX_RECIPIENTS) {
      await prisma.campaign.update({ where: { id }, data: { status: "DRAFT", sentAt: null } });
      return NextResponse.json(
        { success: false, error: `Campaign exceeds ${MAX_RECIPIENTS} recipients. Please create smaller campaigns.` },
        { status: 400 }
      );
    }

    // Build the SMS body
    const smsBody = buildCampaignSmsBody(tenant.name, tenant.slug, campaign.message);

    // Fire-and-forget: process sends in the background so the HTTP request
    // returns immediately instead of blocking for ~50s on 250 recipients.
    // The campaign status tracks progress (SENDING → COMPLETED/FAILED).
    processCampaignSends(id, tenantId, tenant.assignedTwilioNumber!, smsBody, recipients);

    return NextResponse.json({ success: true, message: "Campaign sending started" });
  } catch (error) {
    console.error("Campaign send error:", error);
    return NextResponse.json({ success: false, error: "Failed to send campaign" }, { status: 500 });
  }
}

/**
 * Background processor: sends SMS to all recipients in batches,
 * updating counts atomically as each completes.
 */
async function processCampaignSends(
  campaignId: string,
  tenantId: string,
  fromNumber: string,
  smsBody: string,
  recipients: { id: string; phone: string }[]
) {
  try {
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
              from: fromNumber,
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
                  where: { id: campaignId },
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
                  where: { id: campaignId },
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
                where: { id: campaignId },
                data: { failedCount: { increment: 1 } },
              }),
            ]);
          }
        })
      );
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  } catch (error) {
    console.error("Background campaign send error:", error);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "FAILED" },
    }).catch(() => {});
  }
}
