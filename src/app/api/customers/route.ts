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

    const tenantId = session.user.tenantId;
    const searchParams = req.nextUrl.searchParams;
    const { page, pageSize } = sanitizePagination(searchParams.get("page"), searchParams.get("pageSize"));
    const search = searchParams.get("search")?.trim();

    const where: Prisma.CustomerWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    // Get appointment counts + last booking in a single raw query (O(1) per phone)
    const phones = customers.map((c) => c.phone);
    const phoneStats = phones.length > 0
      ? await prisma.$queryRaw<{ customerPhone: string; count: number; lastBooking: Date | null }[]>`
          SELECT "customerPhone", COUNT(*)::int AS count, MAX("createdAt") AS "lastBooking"
          FROM "Appointment"
          WHERE "tenantId" = ${tenantId} AND "customerPhone" = ANY(${phones})
          GROUP BY "customerPhone"
        `
      : [];

    const countMap = new Map(phoneStats.map((r) => [r.customerPhone, r.count]));
    const lastBookingMap = new Map(phoneStats.map((r) => [r.customerPhone, r.lastBooking]));

    const enriched = customers.map((c) => ({
      ...c,
      appointmentCount: countMap.get(c.phone) ?? 0,
      lastBooking: lastBookingMap.get(c.phone) ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Customers fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}
