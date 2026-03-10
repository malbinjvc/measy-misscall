import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.platformSettings.findUnique({
      where: { id: "platform-settings" },
      select: {
        dashboardBannerUrl: true,
        dashboardBannerType: true,
        dashboardBannerLink: true,
        dashboardBannerEnabled: true,
      },
    });

    if (!settings?.dashboardBannerEnabled || !settings.dashboardBannerUrl) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        url: settings.dashboardBannerUrl,
        type: settings.dashboardBannerType || "image",
        link: settings.dashboardBannerLink || null,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch banner" }, { status: 500 });
  }
}
