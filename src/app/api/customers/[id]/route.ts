import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prismaRead from "@/lib/prisma-read";

/**
 * GET /api/customers/[id] — fetch customer profile + activity (bookings, vehicles, SMS, calls)
 * All activity is paginated per tab via query params.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { id } = params;

    // Fetch customer (tenant-scoped)
    const customer = await prismaRead.customer.findFirst({
      where: { id, tenantId },
      include: { vehicles: { orderBy: { createdAt: "desc" } } },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const { searchParams } = req.nextUrl;
    const tab = searchParams.get("tab") || "bookings";
    const take = 20;
    const cursor = searchParams.get("cursor");

    if (tab === "bookings") {
      const rawBookings = await prismaRead.appointment.findMany({
        where: { tenantId, customerPhone: customer.phone },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          service: { select: { id: true, name: true, price: true } },
          serviceOption: { select: { id: true, name: true, price: true } },
          items: {
            include: {
              service: { select: { id: true, name: true, price: true } },
              serviceOption: { select: { id: true, name: true, price: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      const hasMore = rawBookings.length > take;
      const bookings = hasMore ? rawBookings.slice(0, take) : rawBookings;
      const nextCursor = bookings.length > 0 && hasMore ? bookings[bookings.length - 1].id : null;

      return NextResponse.json({
        success: true,
        data: { customer, bookings },
        hasMore,
        nextCursor,
      });
    }

    if (tab === "sms") {
      const rawSms = await prismaRead.smsLog.findMany({
        where: { tenantId, toNumber: customer.phone, type: { not: "OTP_VERIFICATION" } },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = rawSms.length > take;
      const smsLogs = hasMore ? rawSms.slice(0, take) : rawSms;
      const nextCursor = smsLogs.length > 0 && hasMore ? smsLogs[smsLogs.length - 1].id : null;

      return NextResponse.json({
        success: true,
        data: { customer, smsLogs },
        hasMore,
        nextCursor,
      });
    }

    if (tab === "calls") {
      const rawCalls = await prismaRead.call.findMany({
        where: { tenantId, callerNumber: customer.phone },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = rawCalls.length > take;
      const calls = hasMore ? rawCalls.slice(0, take) : rawCalls;
      const nextCursor = calls.length > 0 && hasMore ? calls[calls.length - 1].id : null;

      return NextResponse.json({
        success: true,
        data: { customer, calls },
        hasMore,
        nextCursor,
      });
    }

    // Default: just return customer + vehicles
    return NextResponse.json({
      success: true,
      data: { customer },
    });
  } catch (error) {
    console.error("Customer detail error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch customer" }, { status: 500 });
  }
}
