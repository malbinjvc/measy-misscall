import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prismaRead from "@/lib/prisma-read";
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
    const cursor = searchParams.get("cursor"); // cursor-based pagination (ID of last item)

    const where: Prisma.SmsLogWhereInput = { tenantId: session.user.tenantId, type: { not: "OTP_VERIFICATION" } };
    if (status) where.status = status as Prisma.EnumSmsStatusFilter;

    // Cursor-based pagination avoids slow OFFSET scans on deep pages (page 500+).
    // If cursor is provided, use keyset pagination and skip count(); otherwise fall back to offset.
    const useCursor = !!cursor;

    const findArgs: Prisma.SmsLogFindManyArgs = {
      where,
      orderBy: { createdAt: "desc" },
      take: useCursor ? pageSize + 1 : pageSize, // fetch one extra in cursor mode to derive hasMore
      ...(useCursor
        ? { cursor: { id: cursor }, skip: 1 }
        : { skip: (page - 1) * pageSize }),
    };

    // Use read replica for listing queries (read-heavy)
    // Skip count() in cursor mode — derive hasMore from extra row instead
    const [rawLogs, total] = await Promise.all([
      prismaRead.smsLog.findMany(findArgs),
      useCursor ? Promise.resolve(-1) : prismaRead.smsLog.count({ where }),
    ]);

    const hasMore = useCursor ? rawLogs.length > pageSize : page < Math.ceil(total / pageSize);
    const logs = useCursor && rawLogs.length > pageSize ? rawLogs.slice(0, pageSize) : rawLogs;
    const nextCursor = logs.length > 0 && hasMore ? logs[logs.length - 1].id : null;

    return NextResponse.json({
      success: true,
      data: logs,
      ...(useCursor ? {} : { total, totalPages: Math.ceil(total / pageSize) }),
      page,
      pageSize,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}
