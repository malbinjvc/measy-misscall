import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sanitizePagination } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";

// List all tickets (admin)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const { page, pageSize } = sanitizePagination(searchParams.get("page"), searchParams.get("pageSize"), 50);

    const where: Prisma.SupportTicketWhereInput = status ? { status: status as never } : {};

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          tenant: { select: { name: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: tickets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("Admin list tickets error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Failed to fetch tickets" }, { status: 500 });
  }
}
