import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sanitizePagination } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { searchParams } = req.nextUrl;
    const search = searchParams.get("search") || "";

    const where = {
      tenantId,
      smsConsent: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
        ],
      }),
    };

    const { page, pageSize, skip } = sanitizePagination(
      searchParams.get("page"),
      searchParams.get("pageSize"),
      50
    );

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: customers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Campaign recipients error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch recipients" }, { status: 500 });
  }
}
