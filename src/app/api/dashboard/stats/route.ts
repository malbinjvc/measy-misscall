import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Get Toronto's UTC offset in hours for a given date.
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

function torontoStartOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const offset = getTorontoOffsetHours(dateStr);
  return new Date(Date.UTC(y, m - 1, d, offset));
}

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
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const dateMode = searchParams.get("dateMode") || "scheduled";

    const hasRange = from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);

    const appointmentDateFilter = hasRange
      ? dateMode === "created"
        ? { createdAt: { gte: torontoStartOfDay(from), lte: torontoEndOfDay(to) } }
        : { date: { gte: new Date(from + "T00:00:00.000Z"), lte: new Date(to + "T23:59:59.999Z") } }
      : {};

    const createdAtFilter = hasRange
      ? { createdAt: { gte: torontoStartOfDay(from), lte: torontoEndOfDay(to) } }
      : {};

    // Build date SQL for raw revenue query.
    // Columns are "timestamp without time zone" but store UTC values. Prisma
    // passes JS Date as timestamptz; PG's server timezone (America/Toronto)
    // causes wrong implicit conversion. AT TIME ZONE 'UTC' strips the offset
    // correctly so the comparison matches the stored UTC timestamps.
    const dateFilterSql = hasRange
      ? dateMode === "created"
        ? Prisma.sql`AND a."createdAt" >= (${torontoStartOfDay(from)} AT TIME ZONE 'UTC') AND a."createdAt" <= (${torontoEndOfDay(to)} AT TIME ZONE 'UTC')`
        : Prisma.sql`AND a."date" >= (${new Date(from + "T00:00:00.000Z")} AT TIME ZONE 'UTC') AND a."date" <= (${new Date(to + "T23:59:59.999Z")} AT TIME ZONE 'UTC')`
      : Prisma.empty;

    const [
      missedCalls,
      totalAppointments,
      pendingAppointments,
      cancelledAppointments,
      noShowAppointments,
      totalSms,
      callbackRequests,
      revenueRows,
    ] = await Promise.all([
      prisma.call.count({
        where: { tenantId, status: "MISSED", ...createdAtFilter },
      }),
      prisma.appointment.count({
        where: { tenantId, ...appointmentDateFilter },
      }),
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
      prisma.call.count({
        where: { tenantId, ivrResponse: "CALLBACK", callbackHandled: false },
      }),
      // Revenue: full SQL calculation covering single-item + multi-item + sub-options
      // Single-item revenue: (service.price + option.price) * quantity
      // Multi-item revenue: SUM per item of (service.price + option.price) * quantity
      // Sub-option revenue: SUM of selected sub-option prices (via unnest on the array)
      prisma.$queryRaw<[{ single_rev: number; multi_rev: number; sub_rev: number; multi_sub_rev: number }]>`
        WITH single_item_rev AS (
          SELECT COALESCE(SUM(
            (COALESCE(s.price, 0) + COALESCE(so.price, 0)) * a.quantity
          ), 0)::float AS total
          FROM "Appointment" a
          LEFT JOIN "Service" s ON s.id = a."serviceId"
          LEFT JOIN "ServiceOption" so ON so.id = a."serviceOptionId"
          WHERE a."tenantId" = ${tenantId}
            AND a.status != 'CANCELLED'
            AND NOT EXISTS (SELECT 1 FROM "AppointmentItem" ai WHERE ai."appointmentId" = a.id)
            ${dateFilterSql}
        ),
        single_sub_rev AS (
          SELECT COALESCE(SUM(sso.price), 0)::float AS total
          FROM "Appointment" a
          JOIN "ServiceOption" so ON so.id = a."serviceOptionId"
          JOIN "ServiceSubOption" sso ON sso."serviceOptionId" = so.id
            AND sso.id = ANY(a."selectedSubOptions")
          WHERE a."tenantId" = ${tenantId}
            AND a.status != 'CANCELLED'
            AND NOT EXISTS (SELECT 1 FROM "AppointmentItem" ai WHERE ai."appointmentId" = a.id)
            ${dateFilterSql}
        ),
        multi_item_rev AS (
          SELECT COALESCE(SUM(
            (COALESCE(s.price, 0) + COALESCE(so.price, 0)) * ai.quantity
          ), 0)::float AS total
          FROM "Appointment" a
          JOIN "AppointmentItem" ai ON ai."appointmentId" = a.id
          LEFT JOIN "Service" s ON s.id = ai."serviceId"
          LEFT JOIN "ServiceOption" so ON so.id = ai."serviceOptionId"
          WHERE a."tenantId" = ${tenantId}
            AND a.status != 'CANCELLED'
            ${dateFilterSql}
        ),
        multi_sub_rev AS (
          SELECT COALESCE(SUM(sso.price), 0)::float AS total
          FROM "Appointment" a
          JOIN "AppointmentItem" ai ON ai."appointmentId" = a.id
          JOIN "ServiceOption" so ON so.id = ai."serviceOptionId"
          JOIN "ServiceSubOption" sso ON sso."serviceOptionId" = so.id
            AND sso.id = ANY(ai."selectedSubOptions")
          WHERE a."tenantId" = ${tenantId}
            AND a.status != 'CANCELLED'
            ${dateFilterSql}
        )
        SELECT
          (SELECT total FROM single_item_rev) AS single_rev,
          (SELECT total FROM multi_item_rev) AS multi_rev,
          (SELECT total FROM single_sub_rev) AS sub_rev,
          (SELECT total FROM multi_sub_rev) AS multi_sub_rev
      `,
    ]);

    const row = revenueRows[0];
    const totalRevenue = (row?.single_rev || 0) + (row?.multi_rev || 0) + (row?.sub_rev || 0) + (row?.multi_sub_rev || 0);

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
