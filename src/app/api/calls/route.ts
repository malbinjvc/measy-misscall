import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import prismaRead from "@/lib/prisma-read";
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
    const cursor = searchParams.get("cursor"); // cursor-based pagination (ID of last item)

    const where: Prisma.CallWhereInput = { tenantId: session.user.tenantId };
    if (status) where.status = status as Prisma.EnumCallStatusFilter;
    if (ivrResponse) where.ivrResponse = ivrResponse as Prisma.EnumIvrResponseFilter;

    // Cursor-based pagination avoids slow OFFSET scans on deep pages (page 500+).
    // If cursor is provided, use keyset pagination and skip count(); otherwise fall back to offset.
    const useCursor = !!cursor;

    // Use read replica for listing queries (read-heavy)
    // Skip count() in cursor mode — derive hasMore from extra row instead
    const [rawCalls, total] = await Promise.all([
      prismaRead.call.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: useCursor ? pageSize + 1 : pageSize,
        ...(useCursor
          ? { cursor: { id: cursor }, skip: 1 }
          : { skip: (page - 1) * pageSize }),
        include: {
          smsLogs: {
            select: { id: true, type: true, status: true, toNumber: true, sentAt: true },
            take: 5,
          },
        },
      }),
      useCursor ? Promise.resolve(-1) : prismaRead.call.count({ where }),
    ]);

    const hasMore = useCursor ? rawCalls.length > pageSize : page < Math.ceil(total / pageSize);
    const calls = useCursor && rawCalls.length > pageSize ? rawCalls.slice(0, pageSize) : rawCalls;
    const nextCursor = calls.length > 0 && hasMore ? calls[calls.length - 1].id : null;

    return NextResponse.json({
      success: true,
      data: calls,
      ...(useCursor ? {} : { total, totalPages: Math.ceil(total / pageSize) }),
      page,
      pageSize,
      nextCursor,
      hasMore,
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
