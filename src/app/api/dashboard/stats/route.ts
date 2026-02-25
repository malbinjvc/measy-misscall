import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;

    const [
      totalCalls,
      missedCalls,
      totalAppointments,
      pendingAppointments,
      totalComplaints,
      openComplaints,
      totalSms,
      callbackRequests,
    ] = await Promise.all([
      prisma.call.count({ where: { tenantId } }),
      prisma.call.count({ where: { tenantId, status: "MISSED" } }),
      prisma.appointment.count({ where: { tenantId } }),
      prisma.appointment.count({ where: { tenantId, status: "PENDING" } }),
      prisma.complaint.count({ where: { tenantId } }),
      prisma.complaint.count({ where: { tenantId, status: "OPEN" } }),
      prisma.smsLog.count({ where: { tenantId } }),
      prisma.call.count({ where: { tenantId, ivrResponse: "CALLBACK" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalCalls,
        missedCalls,
        totalAppointments,
        pendingAppointments,
        totalComplaints,
        openComplaints,
        totalSms,
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
