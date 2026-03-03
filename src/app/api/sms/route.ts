import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sanitizePagination } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const { page, pageSize } = sanitizePagination(searchParams.get("page"), searchParams.get("pageSize"));
    const status = searchParams.get("status");

    const where: Prisma.SmsLogWhereInput = { tenantId: session.user.tenantId, type: { not: "OTP_VERIFICATION" } };
    if (status) where.status = status as Prisma.EnumSmsStatusFilter;

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsLog.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}
