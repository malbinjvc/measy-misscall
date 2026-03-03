import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sanitizePagination } from "@/lib/utils";
import { updateCallSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const { page, pageSize } = sanitizePagination(searchParams.get("page"), searchParams.get("pageSize"));
    const status = searchParams.get("status");
    const ivrResponse = searchParams.get("ivrResponse");

    const where: Prisma.CallWhereInput = { tenantId: session.user.tenantId };
    if (status) where.status = status as Prisma.EnumCallStatusFilter;
    if (ivrResponse) where.ivrResponse = ivrResponse as Prisma.EnumIvrResponseFilter;

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

    const { callId, callbackHandled } = updateCallSchema.parse(await req.json());

    const result = await prisma.call.updateMany({
      where: { id: callId, tenantId: session.user.tenantId },
      data: { callbackHandled },
    });

    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Call not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Call update error:", error);
    return NextResponse.json({ success: false, error: "Failed to update call" }, { status: 500 });
  }
}
