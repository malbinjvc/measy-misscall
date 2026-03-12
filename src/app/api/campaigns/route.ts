import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCampaignSchema } from "@/lib/validations";
import { sanitizePagination } from "@/lib/utils";
import { hasFeature, featureGatedResponse } from "@/lib/feature-gate";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasFeature(session.user.tenantId, "campaigns"))) {
      return NextResponse.json(featureGatedResponse("Campaigns"), { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const { page, pageSize, skip } = sanitizePagination(
      searchParams.get("page"),
      searchParams.get("pageSize")
    );

    const where = { tenantId: session.user.tenantId };

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.campaign.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: campaigns,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Campaigns list error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;

    if (!(await hasFeature(tenantId, "campaigns"))) {
      return NextResponse.json(featureGatedResponse("Campaigns"), { status: 403 });
    }

    const body = await req.json();
    const validated = createCampaignSchema.parse(body);

    // Get eligible recipients (customers with SMS consent, optionally filtered)
    // Bounded to 500 to prevent excessive memory usage + campaign size
    const eligibleCustomers = await prisma.customer.findMany({
      where: {
        tenantId,
        smsConsent: true,
        ...(validated.customerIds?.length && { id: { in: validated.customerIds } }),
      },
      select: { id: true, name: true, phone: true },
      take: 500,
    });

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: validated.name,
        message: validated.message,
        status: "DRAFT",
        recipientCount: eligibleCustomers.length,
        recipients: {
          createMany: {
            data: eligibleCustomers.map((c) => ({
              customerName: c.name,
              phone: c.phone,
            })),
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path?.[0];
        if (field && !fieldErrors[String(field)]) {
          fieldErrors[String(field)] = issue.message;
        }
      }
      return NextResponse.json({ success: false, error: "Validation failed", fieldErrors }, { status: 400 });
    }
    console.error("Campaign create error:", error);
    return NextResponse.json({ success: false, error: "Failed to create campaign" }, { status: 500 });
  }
}
