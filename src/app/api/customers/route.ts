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

    // Get appointment counts for each customer
    const phones = customers.map((c) => c.phone);
    const appointmentCounts = await prisma.appointment.groupBy({
      by: ["customerPhone"],
      where: { tenantId, customerPhone: { in: phones } },
      _count: true,
    });

    const countMap = new Map(appointmentCounts.map((a) => [a.customerPhone, a._count]));

    // Get last booking date per customer
    const lastBookings = await prisma.appointment.findMany({
      where: { tenantId, customerPhone: { in: phones } },
      orderBy: { createdAt: "desc" },
      distinct: ["customerPhone"],
      select: { customerPhone: true, createdAt: true },
    });

    const lastBookingMap = new Map(lastBookings.map((b) => [b.customerPhone, b.createdAt]));

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
