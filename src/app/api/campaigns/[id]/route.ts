import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sanitizePagination } from "@/lib/utils";
import { hasFeature, featureGatedResponse } from "@/lib/feature-gate";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasFeature(session.user.tenantId, "campaigns"))) {
      return NextResponse.json(featureGatedResponse("Campaigns"), { status: 403 });
    }

    const { id } = await params;
    const tenantId = session.user.tenantId;
    const { searchParams } = req.nextUrl;
    const { page, pageSize, skip } = sanitizePagination(
      searchParams.get("page"),
      searchParams.get("pageSize")
    );

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const [recipients, recipientTotal] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where: { campaignId: id },
        orderBy: { sentAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.campaignRecipient.count({ where: { campaignId: id } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        campaign,
        recipients,
        recipientTotal,
        recipientPage: page,
        recipientPageSize: pageSize,
        recipientTotalPages: Math.ceil(recipientTotal / pageSize),
      },
    });
  } catch (error) {
    console.error("Campaign detail error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch campaign" }, { status: 500 });
  }
}

export async function DELETE(
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

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
      select: { status: true },
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status === "SENDING") {
      return NextResponse.json({ success: false, error: "Cannot delete a campaign that is currently sending" }, { status: 400 });
    }

    await prisma.campaign.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Campaign delete error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete campaign" }, { status: 500 });
  }
}
