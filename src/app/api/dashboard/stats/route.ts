import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeAppointmentPrice, computeMultiItemPrice } from "@/lib/appointment-helpers";

/**
 * Get Toronto's UTC offset in hours for a given date.
 * Uses noon UTC to avoid day-boundary issues.
 * Returns 5 for EST, 4 for EDT.
 */
function getTorontoOffsetHours(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12));

  const utcHour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", hour12: false })
      .formatToParts(utcNoon).find((p) => p.type === "hour")?.value || "12"
  );
  const torHour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", hour12: false })
      .formatToParts(utcNoon).find((p) => p.type === "hour")?.value || "12"
  );

  return utcHour - torHour;
}

/** Midnight Toronto time as UTC Date */
function torontoStartOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const offset = getTorontoOffsetHours(dateStr);
  return new Date(Date.UTC(y, m - 1, d, offset));
}

/** 23:59:59.999 Toronto time as UTC Date */
function torontoEndOfDay(dateStr: string): Date {
  const start = torontoStartOfDay(dateStr);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to");     // YYYY-MM-DD

    const hasRange = from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);

    // Appointment date filter — appointment.date is stored as UTC midnight calendar dates
    const appointmentDateFilter = hasRange
      ? { date: { gte: new Date(from + "T00:00:00.000Z"), lte: new Date(to + "T23:59:59.999Z") } }
      : {};

    // Calls and SMS use createdAt (actual timestamps) — filter using Toronto timezone boundaries
    const createdAtFilter = hasRange
      ? { createdAt: { gte: torontoStartOfDay(from), lte: torontoEndOfDay(to) } }
      : {};

    const [
      missedCalls,
      totalAppointments,
      pendingAppointments,
      cancelledAppointments,
      noShowAppointments,
      totalSms,
      callbackRequests,
      revenueAppointments,
    ] = await Promise.all([
      prisma.call.count({
        where: { tenantId, status: "MISSED", ...createdAtFilter },
      }),
      prisma.appointment.count({
        where: { tenantId, ...appointmentDateFilter },
      }),
      // Pending — always unfiltered (current pending regardless of date range)
      prisma.appointment.count({
        where: { tenantId, status: "PENDING" },
      }),
      prisma.appointment.count({
        where: { tenantId, status: "CANCELLED", ...appointmentDateFilter },
      }),
      prisma.appointment.count({
        where: { tenantId, status: "NO_SHOW", ...appointmentDateFilter },
      }),
      prisma.smsLog.count({
        where: { tenantId, type: { not: "OTP_VERIFICATION" }, ...createdAtFilter },
      }),
      // Callback banner — always unfiltered (current pending)
      prisma.call.count({
        where: { tenantId, ivrResponse: "CALLBACK", callbackHandled: false },
      }),
      // Revenue: all non-cancelled appointments with full pricing data
      prisma.appointment.findMany({
        where: { tenantId, status: { not: "CANCELLED" }, ...appointmentDateFilter },
        select: {
          quantity: true,
          selectedSubOptions: true,
          service: { select: { price: true } },
          serviceOption: {
            select: {
              price: true,
              subOptions: { where: { isActive: true }, select: { id: true, price: true } },
            },
          },
          items: {
            select: {
              quantity: true,
              selectedSubOptions: true,
              service: { select: { price: true, duration: true } },
              serviceOption: {
                select: {
                  price: true,
                  duration: true,
                  subOptions: { where: { isActive: true }, select: { id: true, price: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const totalRevenue = revenueAppointments.reduce((sum, apt) => {
      if (apt.items && apt.items.length > 0) {
        return sum + computeMultiItemPrice(apt.items);
      }
      if (!apt.service) return sum;
      return sum + computeAppointmentPrice(
        { quantity: apt.quantity, selectedSubOptions: apt.selectedSubOptions || [] },
        apt.service,
        apt.serviceOption
      );
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        missedCalls,
        totalAppointments,
        pendingAppointments,
        cancelledAppointments,
        noShowAppointments,
        totalSms,
        totalRevenue,
        callbackRequests,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
