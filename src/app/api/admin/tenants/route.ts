import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { users: true, calls: true, appointments: true } },
          subscription: { include: { plan: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: tenants, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id, status, assignedTwilioNumber } = await req.json();

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedTwilioNumber !== undefined) {
      const numberToAssign = normalizePhoneNumber(assignedTwilioNumber);
      if (numberToAssign) {
        const existing = await prisma.tenant.findFirst({
          where: { assignedTwilioNumber: numberToAssign, id: { not: id } },
        });
        if (existing) {
          return NextResponse.json(
            { success: false, error: `This number is already assigned to "${existing.name}"` },
            { status: 400 }
          );
        }
      }
      updateData.assignedTwilioNumber = numberToAssign;
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: tenant });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}
