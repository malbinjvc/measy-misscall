import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const ivrResponse = searchParams.get("ivrResponse");

    const where: any = { tenantId: session.user.tenantId };
    if (status) where.status = status;
    if (ivrResponse) where.ivrResponse = ivrResponse;

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { smsLogs: true },
      }),
      prisma.call.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: calls,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Calls fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch calls" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { callId, callbackHandled } = await req.json();

    if (!callId || typeof callbackHandled !== "boolean") {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }

    // Verify call belongs to tenant
    const call = await prisma.call.findFirst({
      where: { id: callId, tenantId: session.user.tenantId },
    });

    if (!call) {
      return NextResponse.json({ success: false, error: "Call not found" }, { status: 404 });
    }

    const updated = await prisma.call.update({
      where: { id: callId },
      data: { callbackHandled },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Call update error:", error);
    return NextResponse.json({ success: false, error: "Failed to update call" }, { status: 500 });
  }
}
